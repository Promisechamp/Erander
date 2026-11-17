import app from "./app.js";
import { env } from "./config/env.js";
import { startNotificationEmailWorker, stopNotificationEmailWorker } from "./modules/notifications/notificationEmail.worker.js";

const server = app.listen(env.port, () => {
 console.log(`ERANDER API is running at http://localhost:${env.port}`);
console.log(`Environment: ${env.nodeEnv}`);
console.log(`Health check: http://localhost:${env.port}/api/v1/health`);
 startNotificationEmailWorker();
});

// Handle unexpected server errors
server.on("error", (error) => {
if (error.code === "EADDRINUSE") {
console.error("Port ${env.port} is already in use.");
} else {
console.error("Failed to start ERANDER API:", error);
}

process.exitCode = 1;
});

// Gracefully shut down the server
function shutdown(signal) {
console.log("\n${signal} received. Shutting down ERANDER API...");

stopNotificationEmailWorker();
server.close((error) => {
if (error) {
console.error("Error while closing the server:", error);
process.exitCode = 1;
} else {
console.log("ERANDER API shut down successfully.");
}
});
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));