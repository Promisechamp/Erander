import axios from "axios";
import crypto from "node:crypto";

import { env } from "../../config/env.js";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

function getSecretKey() {
	if (!env.paystackSecretKey) {
		throw new Error(
			"Paystack is not configured. Set PAYSTACK_SECRET_KEY in the backend environment.",
		);
	}

	if (
		env.nodeEnv === "production" &&
		env.paystackSecretKey.startsWith("sk_test_")
	) {
		throw new Error(
			"Paystack test keys cannot be used in production.",
		);
	}

	return env.paystackSecretKey;
}

function getAuthorizationHeaders() {
	return {
		Authorization: `Bearer ${getSecretKey()}`,
		"Content-Type": "application/json",
	};
}

function toMinorUnits(amount) {
	const numericAmount = Number(amount);

	if (
		!Number.isFinite(numericAmount) ||
		numericAmount <= 0
	) {
		throw new Error("The payment amount is invalid.");
	}

	const minorUnits = Math.round(numericAmount * 100);

	if (!Number.isSafeInteger(minorUnits) || minorUnits <= 0) {
		throw new Error("The payment amount is outside the supported range.");
	}

	if (Math.abs(numericAmount * 100 - minorUnits) > 0.000001) {
		throw new Error(
			"The payment amount cannot be represented in the currency's minor units.",
		);
	}

	return minorUnits;
}

export async function initializePaystackTransaction({
	email,
	amount,
	currency,
	reference,
	metadata,
}) {
	if (!email || typeof email !== "string") {
		throw new Error("A valid customer email is required for payment.");
	}

	if (!reference) {
		throw new Error("A payment reference is required.");
	}

	const payload = {
		email,
		amount: toMinorUnits(amount),
		currency,
		reference,
		callback_url: env.paystackCallbackUrl,
		metadata,
	};

	const response = await axios.post(
		`${PAYSTACK_BASE_URL}/transaction/initialize`,
		payload,
		{
			headers: getAuthorizationHeaders(),
			timeout: 15000,
		},
	);

	if (!response.data?.status || !response.data?.data?.authorization_url) {
		throw new Error("Paystack did not return a checkout URL.");
	}

	return {
		authorizationUrl: response.data.data.authorization_url,
		accessCode: response.data.data.access_code,
		reference: response.data.data.reference,
	};
}

export async function verifyPaystackTransaction(reference) {
	if (!reference || typeof reference !== "string") {
		throw new Error("A valid payment reference is required.");
	}

	const response = await axios.get(
		`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
		{
			headers: getAuthorizationHeaders(),
			timeout: 15000,
		},
	);

	if (!response.data?.status || !response.data?.data) {
		throw new Error("Paystack could not verify the transaction.");
	}

	return response.data.data;
}

export function verifyPaystackWebhookSignature(rawBody, signature) {
	if (!Buffer.isBuffer(rawBody) || !signature) {
		return false;
	}

	const secret = getSecretKey();

	const expectedSignature = crypto
		.createHmac("sha512", secret)
		.update(rawBody)
		.digest("hex");

	const suppliedBuffer = Buffer.from(String(signature), "utf8");
	const expectedBuffer = Buffer.from(expectedSignature, "utf8");

	if (suppliedBuffer.length !== expectedBuffer.length) {
		return false;
	}

	return crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export function createPayloadHash(rawBody) {
	return crypto.createHash("sha256").update(rawBody).digest("hex");
}