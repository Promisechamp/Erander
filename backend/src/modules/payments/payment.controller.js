import crypto from "node:crypto";
import axios from "axios";
import { getDatabasePool } from "../../config/database.js";

import {
	createPayloadHash,
	initializePaystackTransaction,
	verifyPaystackTransaction,
	verifyPaystackWebhookSignature,
} from "./paystack.service.js";

const PAYMENT_PROVIDER = "paystack";






const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/payments/erands/:erandId/funding-summary
 *
 * Retrieves the current funding summary for an errand owned by
 * the authenticated customer.
 *
 * This endpoint does not create a payment or initialize Paystack.
 */



export async function getErrandFundingSummary(req, res) {
  const { erandId } = req.params;
  const userId = req.user?.id;

  if (!UUID_PATTERN.test(String(erandId || ""))) {
    return sendError(res, 400, "A valid errand ID is required.");
  }

  if (!userId) {
    return sendError(res, 401, "Authentication is required.");
  }

  try {
    const pool = getDatabasePool();

    const result = await pool.query(
      `
        SELECT
          e.id AS errand_id,
          e.requested_by,
          e.assigned_erander_id,
          e.status AS errand_status,
          e.currency_code AS errand_currency_code,
          e.accepted_offer_id,

          o.id AS offer_id,
          o.status AS offer_status,
          o.currency_code AS offer_currency_code,

          f.currency_code AS funding_currency_code,
          f.required_amount,
          f.eligible_funding_amount,
          f.funding_status,
          f.overpayment_amount,

          pending_payment.id AS pending_payment_id,
          pending_payment.provider_reference AS pending_payment_reference,
          pending_payment.amount AS pending_payment_amount,
          pending_payment.currency_code AS pending_payment_currency,
          pending_payment.status AS pending_payment_status,
          pending_payment.initiated_at AS pending_payment_initiated_at

        FROM public.erands e

        LEFT JOIN public.erand_offers o
          ON o.id = e.accepted_offer_id
         AND o.erand_id = e.id

        CROSS JOIN LATERAL public.calculate_erand_funding(e.id) f

        LEFT JOIN LATERAL (
          SELECT
            p.id,
            p.provider_reference,
            p.amount,
            p.currency_code,
            p.status,
            p.initiated_at,
            p.created_at
          FROM public.erand_payments p
          WHERE p.erand_id = e.id
            AND p.payer_id = e.requested_by
            AND p.payment_provider = 'paystack'
            AND p.status = 'pending'
          ORDER BY
            p.initiated_at DESC,
            p.created_at DESC
          LIMIT 1
        ) pending_payment ON TRUE

        WHERE e.id = $1::uuid
          AND (
            e.requested_by = $2::uuid
            OR e.assigned_erander_id = $2::uuid
          )

        LIMIT 1
      `,
      [erandId, userId],
    );

    if (result.rowCount === 0) {
      return sendError(
        res,
        404,
        "Errand not found or you do not have permission to view its funding details.",
      );
    }

    const row = result.rows[0];

    if (!row.accepted_offer_id || !row.offer_id) {
      return sendError(
        res,
        409,
        "An accepted offer is required before this errand can be funded.",
      );
    }

    const currency = String(
      row.funding_currency_code ||
        row.offer_currency_code ||
        row.errand_currency_code ||
        "",
    )
      .trim()
      .toUpperCase();

    if (!currency) {
      return sendError(
        res,
        409,
        "The errand funding currency could not be determined.",
      );
    }

    const agreedTotal = Number(row.required_amount);
    const amountFunded = Number(row.eligible_funding_amount ?? 0);
    const overpaymentAmount = Number(row.overpayment_amount ?? 0);

    if (
      !Number.isFinite(agreedTotal) ||
      !Number.isFinite(amountFunded) ||
      !Number.isFinite(overpaymentAmount)
    ) {
      return sendError(
        res,
        500,
        "The server returned invalid funding amounts.",
      );
    }

    const amountDue = Math.max(agreedTotal - amountFunded, 0);

    const pendingPayment = row.pending_payment_id
      ? {
          paymentId: row.pending_payment_id,
          reference: row.pending_payment_reference,
          amount: Number(row.pending_payment_amount),
          currency: String(
            row.pending_payment_currency || currency,
          )
            .trim()
            .toUpperCase(),
          status: row.pending_payment_status,
          initiatedAt: row.pending_payment_initiated_at,
          errandId: row.errand_id,
        }
      : null;

    return res.status(200).json({
      success: true,
      message: "Errand funding summary retrieved successfully.",
      data: {
        funding: {
          errandId: row.errand_id,
          currency,
          agreedTotal,
          amountFunded,
          amountDue,
          overpaymentAmount,
          fundingStatus: row.funding_status,
          errandStatus: row.errand_status,
        },
        pendingPayment,
      },
    });
  } catch (error) {
    console.error(
      "Failed to retrieve errand funding summary:",
      error,
    );

    return sendError(
      res,
      500,
      "Unable to retrieve the errand funding summary.",
    );
  }
}










function sendError(res, statusCode, message) {
	return res.status(statusCode).json({
		success: false,
		message,
	});
}

function toMinorUnits(amount) {
	const value = Number(amount);

	if (!Number.isFinite(value) || value <= 0) {
		throw new Error("Invalid payment amount.");
	}

	const minorUnits = Math.round(value * 100);

	if (
		!Number.isSafeInteger(minorUnits) ||
		minorUnits <= 0 ||
		Math.abs(value * 100 - minorUnits) > 0.000001
	) {
		throw new Error("Invalid payment amount precision.");
	}

	return minorUnits;
}

function getSafeProviderError(error) {
	const status = error?.response?.status;

	if (status === 400 || status === 422) {
		return "Paystack rejected the transaction request. Check the payment configuration and try again.";
	}

	if (status === 401 || status === 403) {
		return "Paystack authentication failed. Check the backend secret-key configuration.";
	}

	if (status === 429) {
		return "Paystack is temporarily rate-limiting requests. Please try again shortly.";
	}

	return "The payment provider could not complete the request. Please try again.";
}

function isDatabaseError(error) {
	return Boolean(error?.code);
}

async function createOrGetPaymentEvent({
	providerEventId,
	eventType,
	paymentId = null,
	payloadHash = null,
	metadata = {},
}) {
	const pool = getDatabasePool();

	const result = await pool.query(
		`
			INSERT INTO public.erand_payment_events (
				payment_provider,
				provider_event_id,
				event_type,
				payment_id,
				processing_status,
				payload_hash,
				metadata
			)
			VALUES (
				$1,
				$2,
				$3,
				$4,
				'received',
				$5,
				$6::jsonb
			)
			ON CONFLICT (payment_provider, provider_event_id)
			DO UPDATE SET
				updated_at = NOW()
			RETURNING
				id,
				payment_id,
				processing_status
		`,
		[
			PAYMENT_PROVIDER,
			providerEventId,
			eventType,
			paymentId,
			payloadHash,
			JSON.stringify(metadata),
		],
	);

	return result.rows[0];
}

async function claimPaymentEvent(eventId) {
	const pool = getDatabasePool();

	const result = await pool.query(
		"SELECT public.claim_erand_payment_event($1) AS claimed",
		[eventId],
	);

	return result.rows[0]?.claimed === true;
}

async function failPaymentEvent(eventId, reason) {
	const pool = getDatabasePool();

	try {
		await pool.query(
			"SELECT public.fail_erand_payment_event($1, $2)",
			[
				eventId,
				String(reason || "Payment processing failed").slice(0, 1000),
			],
		);
	} catch (error) {
		console.error(
			"Failed to update payment event status:",
			error.message,
		);
	}
}

async function getPaymentByReference(reference) {
	const pool = getDatabasePool();

	const result = await pool.query(
		`
			SELECT
				p.id,
				p.erand_id,
				p.payer_id,
				p.amount,
				p.currency_code,
				p.payment_provider,
				p.provider_reference,
				p.payment_type,
				p.status,
				p.metadata
			FROM public.erand_payments p
			WHERE p.payment_provider = $1
			  AND p.provider_reference = $2
			LIMIT 1
		`,
		[PAYMENT_PROVIDER, reference],
	);

	return result.rows[0] || null;
}

async function validateSuccessfulTransaction(payment, transaction) {
	if (!payment || !transaction) {
		throw new Error(
			"The payment or provider transaction could not be found.",
		);
	}

	if (transaction.status !== "success") {
		throw new Error(
			"The provider has not confirmed a successful payment.",
		);
	}

	if (transaction.reference !== payment.provider_reference) {
		throw new Error(
			"The provider reference does not match the stored payment.",
		);
	}

	if (transaction.currency !== payment.currency_code) {
		throw new Error(
			"The provider currency does not match the stored payment.",
		);
	}

	const expectedMinorUnits = toMinorUnits(payment.amount);
	const receivedMinorUnits = Number(transaction.amount);

	if (
		!Number.isSafeInteger(receivedMinorUnits) ||
		receivedMinorUnits !== expectedMinorUnits
	) {
		throw new Error(
			"The provider amount does not match the stored payment.",
		);
	}

	if (payment.payment_provider !== PAYMENT_PROVIDER) {
		throw new Error("The payment provider does not match.");
	}
}

async function confirmVerifiedPayment({
	eventId,
	payment,
	transaction,
	source,
}) {
	await validateSuccessfulTransaction(payment, transaction);

	const pool = getDatabasePool();

	const amount = (Number(transaction.amount) / 100).toFixed(2);

	const providerConfirmedAt =
		transaction.paid_at &&
		!Number.isNaN(Date.parse(transaction.paid_at))
			? new Date(transaction.paid_at).toISOString()
			: new Date().toISOString();

	const metadata = {
		provider: PAYMENT_PROVIDER,
		transaction_id: transaction.id ?? null,
		transaction_status: transaction.status,
		channel: transaction.channel ?? null,
		gateway_response: transaction.gateway_response ?? null,
	};

	const result = await pool.query(
		`
			SELECT public.confirm_erand_payment(
				$1::uuid,
				$2::uuid,
				$3::text,
				$4::text,
				$5::numeric,
				$6::text,
				$7::timestamptz,
				$8::text,
				$9::text,
				$10::jsonb
			) AS payment_id
		`,
		[
			eventId,
			payment.id,
			PAYMENT_PROVIDER,
			transaction.reference,
			amount,
			transaction.currency,
			providerConfirmedAt,
			source,
			transaction.reference,
			JSON.stringify(metadata),
		],
	);

	return result.rows[0]?.payment_id;
}

async function processPaymentEvent({
	event,
	reference,
	source,
}) {
	const pool = getDatabasePool();

	const payment = await getPaymentByReference(reference);

	if (!payment) {
		await failPaymentEvent(
			event.id,
			"No ERANDER payment matches the provider reference.",
		);

		throw new Error(
			"No ERANDER payment matches this payment reference.",
		);
	}

	if (
		event.payment_id &&
		event.payment_id !== payment.id
	) {
		await failPaymentEvent(
			event.id,
			"Payment event references a different payment.",
		);

		throw new Error(
			"The payment event references a different payment.",
		);
	}

	if (event.processing_status === "processed") {
		if (event.payment_id && event.payment_id === payment.id) {
			return {
				paymentId: payment.id,
				alreadyProcessed: true,
			};
		}

		throw new Error(
			"The event is processed but is not associated with the expected payment.",
		);
	}

	const claimed = await claimPaymentEvent(event.id);

	if (!claimed) {
		const latestEvent = await pool.query(
			`
				SELECT processing_status, payment_id
				FROM public.erand_payment_events
				WHERE id = $1
			`,
			[event.id],
		);

		const latest = latestEvent.rows[0];

		if (
			latest?.processing_status === "processed" &&
			latest.payment_id === payment.id
		) {
			return {
				paymentId: payment.id,
				alreadyProcessed: true,
			};
		}

		throw new Error(
			"The payment event is already being processed.",
		);
	}

	try {
		const transaction = await verifyPaystackTransaction(reference);

		await validateSuccessfulTransaction(payment, transaction);

		const confirmedPaymentId = await confirmVerifiedPayment({
			eventId: event.id,
			payment,
			transaction,
			source,
		});

		return {
			paymentId: confirmedPaymentId || payment.id,
			alreadyProcessed: false,
		};
	} catch (error) {
		await failPaymentEvent(event.id, error.message);
		throw error;
	}
}





/**
 * Initialize a Paystack transaction for the authenticated customer.
 *
 * The outstanding amount is calculated using the database's canonical
 * calculate_erand_funding() function so the checkout amount follows the
 * same confirmed-payment and successful-refund rules as the funding summary.
 */


export async function initializePayment(req, res) {
	console.log("[PAYMENT DEBUG] initializePayment reached");
	const { erandId } = req.params;
	const userId = req.user?.id;

	if (!erandId) {
		return sendError(res, 400, "An errand ID is required.");
	}

	if (!userId) {
		return sendError(res, 401, "Authentication is required.");
	}

	if (!req.user?.email) {
		return sendError(
			res,
			400,
			"Your account must have an email address before making a payment.",
		);
	}

	const pool = getDatabasePool();

	let payment;
	let client;

	try {
		client = await pool.connect();

		await client.query("BEGIN");

		/*
		 * Lock the errand row while checking ownership, accepted-offer
		 * details, and the outstanding funding balance.
		 *
		 * requested_by is the errand owner's column.
		 * calculate_erand_funding() is the canonical funding calculation.
		 */
		const errandResult = await client.query(
			`
				SELECT
					e.id AS errand_id,
					e.requested_by,
					e.status AS errand_status,
					e.currency_code AS errand_currency_code,
					e.accepted_offer_id,

					o.id AS offer_id,
					o.status AS offer_status,
					o.proposed_total AS offer_total,
					o.currency_code AS offer_currency_code,

					f.currency_code AS funding_currency_code,
					f.required_amount AS funding_required_amount,
					f.eligible_funding_amount,
					f.funding_status,
					f.overpayment_amount

				FROM public.erands e

				LEFT JOIN public.erand_offers o
					ON o.id = e.accepted_offer_id
					AND o.erand_id = e.id

				CROSS JOIN LATERAL
					public.calculate_erand_funding(e.id) f

				WHERE e.id = $1::uuid
					AND e.requested_by = $2

				FOR UPDATE OF e
			`,
			[erandId, userId],
		);

		const errand = errandResult.rows[0];

		if (!errand) {
			await client.query("ROLLBACK");

			return sendError(
				res,
				404,
				"Errand not found.",
			);
		}

		if (
			!errand.accepted_offer_id ||
			!errand.offer_id ||
			errand.offer_status !== "accepted" ||
			errand.funding_status === "offer_not_accepted" ||
			errand.funding_required_amount == null
		) {
			await client.query("ROLLBACK");

			return sendError(
				res,
				409,
				"An accepted offer is required before this errand can be funded.",
			);
		}

		if (errand.errand_status !== "awaiting_funding") {
			await client.query("ROLLBACK");

			return sendError(
				res,
				409,
				"This errand is not currently awaiting funding.",
			);
		}

		/*
		 * Normalize currency values because PostgreSQL CHAR columns can
		 * contain trailing spaces.
		 */
		const errandCurrency = String(
			errand.errand_currency_code ?? "",
		)
			.trim()
			.toUpperCase();

		const offerCurrency = String(
			errand.offer_currency_code ?? "",
		)
			.trim()
			.toUpperCase();

		const fundingCurrency = String(
			errand.funding_currency_code ?? "",
		)
			.trim()
			.toUpperCase();

		if (
			!fundingCurrency ||
			errandCurrency !== offerCurrency ||
			offerCurrency !== fundingCurrency
		) {
			await client.query("ROLLBACK");

			return sendError(
				res,
				409,
				"The errand, accepted offer, and funding currencies do not match. Please contact support.",
			);
		}

		if (fundingCurrency !== "NGN") {
			await client.query("ROLLBACK");

			return sendError(
				res,
				400,
				"Paystack checkout is currently configured for NGN transactions only.",
			);
		}

		/*
		 * Use the database function's canonical funding values.
		 * Eligible funding already accounts for the database function's
		 * payment and refund rules.
		 */
		const requiredAmount = Number(
			errand.funding_required_amount,
		);

		const eligibleFundingAmount = Number(
			errand.eligible_funding_amount ?? 0,
		);

		if (
			!Number.isFinite(requiredAmount) ||
			requiredAmount <= 0 ||
			!Number.isFinite(eligibleFundingAmount) ||
			eligibleFundingAmount < 0
		) {
			await client.query("ROLLBACK");

			return sendError(
				res,
				409,
				"The errand funding amount is invalid. Please contact support.",
			);
		}

		const outstandingAmount = Number(
			Math.max(
				requiredAmount - eligibleFundingAmount,
				0,
			).toFixed(2),
		);

		if (outstandingAmount <= 0) {
			await client.query("ROLLBACK");

			return sendError(
				res,
				409,
				"No additional funding is currently required for this errand.",
			);
		}

		/*
		 * Validate that the amount can be represented in Paystack's
		 * smallest currency unit.
		 */
		const amountInMinorUnits = toMinorUnits(
			outstandingAmount,
		);

		if (
			!Number.isSafeInteger(amountInMinorUnits) ||
			amountInMinorUnits <= 0
		) {
			await client.query("ROLLBACK");

			return sendError(
				res,
				400,
				"The outstanding payment amount is invalid.",
			);
		}

		/*
		 * Reuse a pending payment only if its amount and currency match
		 * the current outstanding balance.
		 *
		 * Lock the selected payment to prevent concurrent modifications.
		 */
		const pendingResult = await client.query(
			`
				SELECT
					id,
					amount,
					currency_code,
					provider_reference,
					metadata,
					status
				FROM public.erand_payments
				WHERE erand_id = $1
					AND payer_id = $2
					AND payment_provider = $3
					AND status = 'pending'
					AND currency_code = $4
					AND amount = $5
				ORDER BY created_at DESC
				LIMIT 1
				FOR UPDATE
			`,
			[
				erandId,
				userId,
				PAYMENT_PROVIDER,
				fundingCurrency,
				outstandingAmount,
			],
		);

		if (pendingResult.rows.length > 0) {
			payment = pendingResult.rows[0];
		} else {
			const reference = `ERD_${crypto
				.randomUUID()
				.replaceAll("-", "")}`;

			const paymentResult = await client.query(
				`
					INSERT INTO public.erand_payments (
						erand_id,
						payer_id,
						payment_type,
						amount,
						currency_code,
						payment_provider,
						provider_reference,
						status,
						metadata
					)
					VALUES (
						$1,
						$2,
						'customer_deposit',
						$3,
						$4,
						$5,
						$6,
						'pending',
						$7::jsonb
					)
					RETURNING
						id,
						amount,
						currency_code,
						provider_reference,
						metadata,
						status
				`,
				[
					erandId,
					userId,
					outstandingAmount,
					fundingCurrency,
					PAYMENT_PROVIDER,
					reference,
					JSON.stringify({
						provider: PAYMENT_PROVIDER,
						initialization_status: "pending",
					}),
				],
			);

			payment = paymentResult.rows[0];
		}

		await client.query("COMMIT");
	} catch (error) {
		if (client) {
			try {
				await client.query("ROLLBACK");
			} catch {
				// Preserve the original error.
			}
		}

		console.error(
			"Payment initialization database error:",
			error.message,
		);

		return sendError(
			res,
			500,
			"Unable to prepare the payment. Please try again.",
		);
	} finally {
		client?.release();
	}

	/*
	 * If this payment already has a checkout URL, return it instead of
	 * creating another Paystack transaction.
	 */
	const existingAuthorizationUrl =
		payment.metadata?.authorization_url;

	if (existingAuthorizationUrl) {
		return res.status(200).json({
			success: true,
			message: "An existing payment checkout is available.",
			data: {
				paymentId: payment.id,
				reference: payment.provider_reference,
				amount: Number(payment.amount),
				currency: String(payment.currency_code)
					.trim()
					.toUpperCase(),
				authorization_url: existingAuthorizationUrl,
				authorizationUrl: existingAuthorizationUrl,
				accessCode: payment.metadata?.access_code ?? null,
			},
		});
	}

	/*
	 * Initialize Paystack outside the database transaction so that a
	 * network request does not keep database locks open.
	 */
	try {
		const checkout = await initializePaystackTransaction({
			email: req.user.email,
			amount: payment.amount,
			currency: String(payment.currency_code)
				.trim()
				.toUpperCase(),
			reference: payment.provider_reference,
			metadata: {
				payment_id: payment.id,
				erand_id: erandId,
				customer_id: userId,
				purpose: "erand_funding",
			},
		});

		if (!checkout?.authorizationUrl) {
			throw new Error(
				"Paystack did not return an authorization URL.",
			);
		}

		const updateResult = await pool.query(
			`
				UPDATE public.erand_payments
				SET metadata =
					COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
					updated_at = NOW()
				WHERE id = $1
					AND status = 'pending'
				RETURNING id
			`,
			[
				payment.id,
				JSON.stringify({
					authorization_url: checkout.authorizationUrl,
					access_code: checkout.accessCode ?? null,
					initialization_status: "initialized",
				}),
			],
		);

		if (updateResult.rowCount !== 1) {
			console.error(
				"Paystack initialized, but the payment record could not be updated.",
				{
					paymentId: payment.id,
					reference: payment.provider_reference,
				},
			);

			return sendError(
				res,
				409,
				"The payment status changed during checkout initialization. Please check your payment history before trying again.",
			);
		}

		return res.status(200).json({
			success: true,
			message: "Payment checkout initialized successfully.",
			data: {
				paymentId: payment.id,
				reference: checkout.reference,
				amount: Number(payment.amount),
				currency: String(payment.currency_code)
					.trim()
					.toUpperCase(),
				authorization_url: checkout.authorizationUrl,
				authorizationUrl: checkout.authorizationUrl,
				accessCode: checkout.accessCode ?? null,
			},
		});
	} 
	
	catch (error) {
    console.error("Paystack initialization failed:", {
        message: error.message,
        stack: error.stack,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
        responseDataType: typeof error.response?.data,
        isAxiosError: axios.isAxiosError(error),
    });

    if (axios.isAxiosError(error)) {
        return sendError(
            res,
            502,
            getSafeProviderError(error),
        );
    }

    return sendError(
        res,
        502,
        "Payment checkout initialization failed. Check the backend logs.",
    );
}
}





export async function verifyPayment(req, res) {
	const { paymentId } = req.params;

	if (!paymentId) {
		return sendError(res, 400, "A payment ID is required.");
	}

	const pool = getDatabasePool();

	try {
		const paymentResult = await pool.query(
			`
				SELECT
					p.id,
					p.erand_id,
					p.payer_id,
					p.amount,
					p.currency_code,
					p.payment_provider,
					p.provider_reference,
					p.status
				FROM public.erand_payments p
				WHERE p.id = $1
				  AND p.payer_id = $2
				LIMIT 1
			`,
			[paymentId, req.user.id],
		);

		const payment = paymentResult.rows[0];

		if (!payment) {
			return sendError(res, 404, "Payment not found.");
		}

		if (payment.payment_provider !== PAYMENT_PROVIDER) {
			return sendError(
				res,
				400,
				"This payment does not use Paystack.",
			);
		}

		if (payment.status === "reversed") {
			return sendError(
				res,
				409,
				"This payment has been reversed.",
			);
		}

		const reference = payment.provider_reference;

		if (!reference) {
			return sendError(
				res,
				409,
				"This payment does not have a provider reference.",
			);
		}

		const event = await createOrGetPaymentEvent({
			providerEventId: `api-verification:${reference}`,
			eventType: "api.transaction.verification",
			paymentId: payment.id,
			metadata: {
				source: "authenticated_api_verification",
				reference,
			},
		});

		if (
			event.processing_status === "processed" &&
			event.payment_id === payment.id
		) {
			return res.status(200).json({
				success: true,
				message: "This payment has already been verified.",
				data: {
					paymentId: payment.id,
					status: "confirmed",
					reference,
				},
			});
		}

		const result = await processPaymentEvent({
			event,
			reference,
			source: "provider_api_verification",
		});

		return res.status(200).json({
			success: true,
			message: "Payment verified successfully.",
			data: {
				paymentId: result.paymentId,
				status: "confirmed",
				reference,
			},
		});
	} catch (error) {
		console.error(
			"Payment verification failed:",
			error.message,
		);

		if (error.response?.status) {
			return sendError(
				res,
				502,
				"Paystack could not verify the payment. Please try again.",
			);
		}

		if (
			error.message?.includes("not confirmed") ||
			error.message?.includes("does not match")
		) {
			return sendError(res, 409, error.message);
		}

		
		
		if (isDatabaseError(error)) {
    return res.status(500).json({
        success: false,
        message: error.message,
        code: error.code,
    });
}

		return sendError(
			res,
			502,
			"Payment verification could not be completed. Please try again.",
		);
	}
}

export async function handlePaystackWebhook(req, res) {
	const rawBody = req.body;

	if (!Buffer.isBuffer(rawBody)) {
		return sendError(
			res,
			400,
			"Webhook body was not received in its original format.",
		);
	}

	const signature = req.headers["x-paystack-signature"];

	let signatureValid = false;

	try {
		signatureValid = verifyPaystackWebhookSignature(
			rawBody,
			signature,
		);
	} catch (error) {
		console.error(
			"Paystack webhook configuration error:",
			error.message,
		);

		return sendError(
			res,
			500,
			"Payment webhook configuration is unavailable.",
		);
	}

	if (!signatureValid) {
		return sendError(
			res,
			401,
			"Invalid payment webhook signature.",
		);
	}

	let payload;

	try {
		payload = JSON.parse(rawBody.toString("utf8"));
	} catch {
		return sendError(res, 400, "Invalid webhook JSON.");
	}

	if (payload.event !== "charge.success") {
		return res.status(200).json({
			success: true,
			message: "Webhook event acknowledged.",
		});
	}

	const reference = payload.data?.reference;

	if (!reference) {
		return sendError(
			res,
			400,
			"The successful charge webhook has no payment reference.",
		);
	}

	const transactionId = payload.data?.id;

	const providerEventId =
		transactionId !== undefined && transactionId !== null
			? `charge.success:${transactionId}`
			: `charge.success:${reference}`;

	let event;

	try {
		const payment = await getPaymentByReference(reference);

		event = await createOrGetPaymentEvent({
			providerEventId,
			eventType: "charge.success",
			paymentId: payment?.id || null,
			payloadHash: createPayloadHash(rawBody),
			metadata: {
				event: payload.event,
				reference,
				transaction_id: transactionId ?? null,
				webhook_source: "paystack",
			},
		});

		if (event.processing_status === "processed") {
			return res.status(200).json({
				success: true,
				message: "Duplicate webhook acknowledged.",
			});
		}

		await processPaymentEvent({
			event,
			reference,
			source: "provider_webhook",
		});

		return res.status(200).json({
			success: true,
			message: "Payment webhook processed successfully.",
		});
	} catch (error) {
		console.error(
			"Paystack webhook processing failed:",
			error.message,
		);

		if (event?.id) {
			await failPaymentEvent(event.id, error.message);
		}

		// A non-2xx response allows Paystack to retry.
		return res.status(500).json({
			success: false,
			message: "Payment webhook processing failed.",
		});
	}
}