import { randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

const CSRF_COOKIE = "erander_csrf";
const CSRF_HEADER = "x-csrf-token";

const cookieOptions = {
httpOnly: true,
secure: env.nodeEnv === "production",
sameSite: "strict",
path: "/api/v1",
};

function safeEqual(a, b) {
if (typeof a !== "string" || typeof b !== "string") {
return false;
}

const left = Buffer.from(a);
const right = Buffer.from(b);

return (
left.length === right.length &&
timingSafeEqual(left, right)
);
}

export function issueCsrfToken(req, res) {
const token = randomBytes(32).toString("hex");

res.cookie(CSRF_COOKIE, token, cookieOptions);

return res.status(200).json({
success: true,
data: { csrfToken: token },
});
}

export function requireCsrf(req, res, next) {
const cookieToken = req.cookies?.[CSRF_COOKIE];
const headerToken = req.get(CSRF_HEADER);

if (!safeEqual(cookieToken, headerToken)) {
return res.status(403).json({
success: false,
message: "Security verification failed. Refresh the page and try again.",
});
}

next();
}

export function clearCsrfCookie(res) {
res.clearCookie(CSRF_COOKIE, cookieOptions);
}





// CSRF (Cross-Site Request Forgery) is an attack where a malicious 
// website tricks a logged-in user’s browser into performing 
// unwanted actions on another website.
// Why ERANDER needs it: Since ERANDER uses authentication cookies, 
// CSRF protection helps prevent unauthorized actions, such as creating 
// errands or changing account details, without the user's intention.