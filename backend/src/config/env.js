import dotenv from "dotenv";

dotenv.config();

const port = Number(process.env.PORT || 5000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
	throw new Error("PORT must be a valid port number.");
}

export const env = Object.freeze({
	nodeEnv: process.env.NODE_ENV || "development",
	port,
	frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
	databaseUrl: process.env.DATABASE_URL || "",

	paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || "",
	smtpHost: process.env.SMTP_HOST || "",
	smtpPort: Number(process.env.SMTP_PORT || 587),
	smtpSecure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
	smtpUser: process.env.SMTP_USER || "",
	smtpPass: process.env.SMTP_PASS || "",
	emailFrom: process.env.EMAIL_FROM || "",
	paystackCallbackUrl:
		process.env.PAYSTACK_CALLBACK_URL ||
		"http://localhost:5173/payment/callback",
});