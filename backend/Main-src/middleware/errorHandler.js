export function errorHandler(err, req, res, next) {
const statusCode =
Number.isInteger(err.statusCode) &&
err.statusCode >= 400 &&
err.statusCode <= 599
? err.statusCode
: 500;

if (statusCode >= 500) {
console.error("ERANDER API error:", err);
}

res.status(statusCode).json({
success: false,
message:
statusCode >= 500
? "An unexpected server error occurred."
: err.message || "The request could not be completed.",
});
}