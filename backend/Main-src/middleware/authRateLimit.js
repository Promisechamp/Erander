import { rateLimit } from "express-rate-limit";

export const loginRateLimit = rateLimit({
windowMs: 15 * 60 * 1000,

// Allow up to 10 login attempts per IP in a 15-minute window.
limit: 10,

// Don't reveal rate-limit details unnecessarily.
standardHeaders: "draft-8",
legacyHeaders: false,

// Count failed attempts rather than successful logins.
skipSuccessfulRequests: true,

message: {
success: false,
message:
"Too many login attempts. Please wait a while before trying again.",
},

handler: (req, res, next, options) => {
res.status(options.statusCode).json(options.message);
},
});