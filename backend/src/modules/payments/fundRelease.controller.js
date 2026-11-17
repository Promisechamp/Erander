import { getDatabasePool } from "../../config/database.js";
import { notifyUsers } from "../notifications/notification.service.js";
import { getErrandSecurityDepositVerification } from "./securityDepositStatus.service.js";

function sendError(res, statusCode, message, code) {
    return res.status(statusCode).json({
        success: false,
        message,
        ...(code ? { code } : {}),
    });
}

function serializeRequest(row) {
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        erandId: row.erand_id,
        eranderId: row.erander_id,
        status: row.status,
        requestedAt: row.requested_at,
        reviewedAt: row.reviewed_at,
        reviewedBy: row.reviewed_by,
        releaseInitiatedAt: row.release_initiated_at,
        releasedAt: row.released_at,
        providerReference: row.provider_reference,
        decisionReason: row.decision_reason,
        failureReason: row.failure_reason,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/**
 * The selected erander requests release of funds for an already-funded
 * errand.
 *
 * This endpoint only records the request. It does not initiate a transfer
 * or mark funds as released.
 */
export async function requestFundRelease(req, res) {
    const erandId = req.params.erandId;
    const eranderId = req.user?.id;

    if (!erandId || !eranderId) {
        return sendError(
            res,
            400,
            "An errand ID and authenticated erander are required.",
            "INVALID_REQUEST",
        );
    }

    let client;
    let transactionStarted = false;

    try {
        const pool = getDatabasePool();

        client = await pool.connect();

        await client.query("BEGIN");
        transactionStarted = true;

        // Lock the errand row while validating and creating the request.
        const errandResult = await client.query(
            `
                SELECT
                    id,
                    requested_by,
                    status,
                    assigned_erander_id,
                    accepted_offer_id
                FROM public.erands
                WHERE id = $1
                FOR UPDATE
            `,
            [erandId],
        );

        if (errandResult.rowCount === 0) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return sendError(
                res,
                404,
                "Errand not found.",
                "ERRAND_NOT_FOUND",
            );
        }

        const errand = errandResult.rows[0];

        // Only the selected erander may request the release.
        if (errand.assigned_erander_id !== eranderId) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return sendError(
                res,
                403,
                "Only the selected erander can request release of these funds.",
                "NOT_SELECTED_ERANDER",
            );
        }

        // Funding must already have been confirmed by the backend.
        if (errand.status !== "funded") {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return sendError(
                res,
                409,
                "Fund release can only be requested after the errand is confirmed as funded.",
                "ERRAND_NOT_ELIGIBLE_FOR_RELEASE",
            );
        }

        // Return an existing active or completed request instead of creating
        // another one.
        const existingResult = await client.query(
            `
                SELECT *
                FROM public.erand_fund_release_requests
                WHERE erand_id = $1
                  AND status IN (
                      'pending',
                      'approved',
                      'processing',
                      'released'
                  )
                ORDER BY requested_at DESC
                LIMIT 1
            `,
            [erandId],
        );

        if (existingResult.rowCount > 0) {
            const existing = existingResult.rows[0];

            await client.query("COMMIT");
            transactionStarted = false;

            return res.status(200).json({
                success: true,
                message:
                    existing.status === "released"
                        ? "Funds have already been released for this errand."
                        : "A fund-release request already exists for this errand.",
                data: {
                    request: serializeRequest(existing),
                    existing: true,
                },
            });
        }

        // A confirmed 100% security-deposit reservation for this exact errand
        // and assigned erander is mandatory before a release request can exist.
        // This verification runs while the errand row is locked, in the same
        // transaction as request creation.
        const securityDeposit = await getErrandSecurityDepositVerification(
            client,
            errandResult.rows[0],
        );

        if (!securityDeposit.secured) {
            await client.query("ROLLBACK");
            transactionStarted = false;

            return sendError(
                res,
                409,
                securityDeposit.status === "processing"
                    ? "Your security-deposit reservation is still processing. You can request fund release once it is confirmed."
                    : "A confirmed 100% security-deposit reservation is required before you can request fund release.",
                "SECURITY_DEPOSIT_REQUIRED",
            );
        }

        const insertResult = await client.query(
            `
                INSERT INTO public.erand_fund_release_requests (
                    erand_id,
                    erander_id,
                    status
                )
                VALUES ($1, $2, 'pending')
                RETURNING *
            `,
            [erandId, eranderId],
        );

        const request = insertResult.rows[0];

        // Record the request event using the request's authoritative timestamp.
        await client.query(
            `
                INSERT INTO public.erand_fund_release_request_events (
                    request_id,
                    erand_id,
                    actor_id,
                    event_type,
                    occurred_at,
                    details
                )
                VALUES ($1, $2, $3, 'fund_release_requested', $4, $5::jsonb)
            `,
            [
                request.id,
                erandId,
                eranderId,
                request.requested_at,
                JSON.stringify({
                    source: "erander_errand_details",
                }),
            ],
        );

        await client.query("COMMIT");
        transactionStarted = false;

        notifyUsers([errand.requested_by], {
            type: "fund_release_requested",
            title: "Your erander requested execution funds",
            body: "The assigned erander has requested release of the funded execution budget. The request is awaiting admin review.",
            actionUrl: "/dashboard/erands",
            entityType: "erand",
            entityId: erandId,
            data: { requestId: request.id },
            dedupeKey: `fund_release_requested:${request.id}`,
        }).catch((error) => console.error("Fund-release request notification failed:", error?.message));
        getDatabasePool().query(
            `SELECT DISTINCT profile_id FROM public.admin_role_assignments
              WHERE assignment_status = 'active' AND role_code IN ('super_admin', 'finance_admin')`,
        ).then((admins) => notifyUsers(admins.rows.map((row) => row.profile_id), {
            type: "admin_fund_release_request",
            title: "New errand fund-release request",
            body: `An erander requested execution-fund release for ${errandId}. Review funding, security deposit and agreement before taking action.`,
            actionUrl: "/admin/fund-releases",
            entityType: "erand",
            entityId: erandId,
            data: { requestId: request.id },
            dedupeKey: `admin_fund_release_request:${request.id}`,
        })).catch((error) => console.error("Admin fund-release notification failed:", error?.message));

        return res.status(201).json({
            success: true,
            message:
                "Fund-release request submitted successfully.",
            data: {
                request: serializeRequest(request),
                existing: false,
            },
        });
    } catch (error) {
        if (transactionStarted && client) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error(
                    "Unable to roll back fund-release request:",
                    rollbackError,
                );
            }
        }

        // Handle a concurrent request that won the unique-index race.
        if (error?.code === "23505" && client) {
            try {
                const existingResult = await client.query(
                    `
                        SELECT *
                        FROM public.erand_fund_release_requests
                        WHERE erand_id = $1
                          AND status IN (
                              'pending',
                              'approved',
                              'processing',
                              'released'
                          )
                        ORDER BY requested_at DESC
                        LIMIT 1
                    `,
                    [erandId],
                );

                if (existingResult.rowCount > 0) {
                    return res.status(200).json({
                        success: true,
                        message:
                            "A fund-release request already exists for this errand.",
                        data: {
                            request: serializeRequest(
                                existingResult.rows[0],
                            ),
                            existing: true,
                        },
                    });
                }
            } catch (lookupError) {
                console.error(
                    "Unable to retrieve existing fund-release request:",
                    lookupError,
                );
            }
        }

        console.error(
            "Unable to create fund-release request:",
            error,
        );

        return sendError(
            res,
            500,
            "Unable to submit the fund-release request. Please try again.",
            "FUND_RELEASE_REQUEST_FAILED",
        );
    } finally {
        client?.release();
    }
}

/**
 * Allows the customer or selected erander to retrieve the current
 * fund-release request and its timestamped events.
 */
export async function getFundReleaseRequest(req, res) {
    const erandId = req.params.erandId;
    const userId = req.user?.id;

    if (!erandId || !userId) {
        return sendError(
            res,
            400,
            "An errand ID and authenticated user are required.",
            "INVALID_REQUEST",
        );
    }

    let client;

    try {
        const pool = getDatabasePool();

        client = await pool.connect();

        // The authorization condition is applied before request details
        // are returned.
        const accessResult = await client.query(
            `
                SELECT
                    id,
                    requested_by,
                    assigned_erander_id
                FROM public.erands
                WHERE id = $1
                  AND (
                      requested_by = $2
                      OR assigned_erander_id = $2
                  )
                LIMIT 1
            `,
            [erandId, userId],
        );

        if (accessResult.rowCount === 0) {
            return sendError(
                res,
                404,
                "Errand not found.",
                "ERRAND_NOT_FOUND",
            );
        }

        const requestResult = await client.query(
            `
                SELECT *
                FROM public.erand_fund_release_requests
                WHERE erand_id = $1
                ORDER BY requested_at DESC
                LIMIT 1
            `,
            [erandId],
        );

        if (requestResult.rowCount === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    request: null,
                    events: [],
                },
            });
        }

        const request = requestResult.rows[0];

        const eventsResult = await client.query(
            `
                SELECT
                    id,
                    actor_id,
                    event_type,
                    occurred_at,
                    details
                FROM public.erand_fund_release_request_events
                WHERE request_id = $1
                ORDER BY occurred_at ASC, id ASC
            `,
            [request.id],
        );

        return res.status(200).json({
            success: true,
            data: {
                request: serializeRequest(request),
                events: eventsResult.rows.map((event) => ({
                    id: event.id,
                    actorId: event.actor_id,
                    type: event.event_type,
                    occurredAt: event.occurred_at,
                    details: event.details,
                })),
            },
        });
    } catch (error) {
        console.error(
            "Unable to retrieve fund-release request:",
            error,
        );

        return sendError(
            res,
            500,
            "Unable to load the fund-release request. Please try again.",
            "FUND_RELEASE_REQUEST_LOOKUP_FAILED",
        );
    } finally {
        client?.release();
    }
}

/**
 * Returns the customer-safe security-deposit status for the assigned erander
 * on this errand. No amount, wallet balance, account ID or transaction data
 * is exposed.
 */
export async function getErrandSecurityDepositStatus(req, res) {
    const erandId = req.params.erandId;
    const customerId = req.user?.id;

    if (!erandId || !customerId) {
        return sendError(
            res,
            400,
            "An errand ID and authenticated customer are required.",
            "INVALID_REQUEST",
        );
    }

    let client;

    try {
        const pool = getDatabasePool();
        client = await pool.connect();

        const errandResult = await client.query(
            `
                SELECT
                    id,
                    requested_by,
                    assigned_erander_id,
                    accepted_offer_id
                FROM public.erands
                WHERE id = $1::uuid
                  AND requested_by = $2::uuid
                LIMIT 1
            `,
            [erandId, customerId],
        );

        if (errandResult.rowCount === 0) {
            return sendError(
                res,
                404,
                "Errand not found.",
                "ERRAND_NOT_FOUND",
            );
        }

        const verification = await getErrandSecurityDepositVerification(
            client,
            errandResult.rows[0],
        );

        return res.status(200).json({
            success: true,
            data: {
                status: verification.status,
            },
        });
    } catch (error) {
        console.error(
            "Unable to verify errand security-deposit status:",
            error,
        );

        return sendError(
            res,
            503,
            "Security-deposit status is temporarily unavailable. Please try again.",
            "SECURITY_DEPOSIT_STATUS_UNAVAILABLE",
        );
    } finally {
        client?.release();
    }
}
