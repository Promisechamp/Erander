import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorHandler.js";
import apiRoutes from "./routes/index.js";

import { handlePaystackWebhook } from "./modules/payments/payment.controller.js";

const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
	cors({
		origin: env.frontendUrl,
		credentials: true,
	}),
);

app.use(compression());

if (env.nodeEnv === "development") {
	app.use(morgan("dev"));
}

/**
 * Paystack webhook
 *
 * This endpoint must be registered before express.json() so the
 * controller receives the original request bytes as a Buffer.
 *
 * Paystack authenticates this endpoint through its webhook signature.
 * Do not apply customer authentication or browser CSRF protection here.
 */
app.post(
	"/api/v1/payments/paystack/webhook",
	express.raw({
		type: "application/json",
		limit: "1mb",
	}),
	handlePaystackWebhook,
);

/**
 * Normal application request parsing.
 */
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

/**
 * Health check.
 */
app.get("/api/v1/health", (req, res) => {
	res.status(200).json({
		success: true,
		message: "ERANDER API is running.",
		environment: env.nodeEnv,
		timestamp: new Date().toISOString(),
	});
});

/**
 * API routes.
 */
app.use("/api/v1", apiRoutes);

/**
 * Not-found and centralized error handling.
 */
app.use(notFound);
app.use(errorHandler);

export default app;