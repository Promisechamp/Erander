import pg from "pg";
import { env } from "./env.js";

const { Pool } = pg;

let pool;

export function getDatabasePool() {
	if (!env.databaseUrl) {
		throw new Error(
			"DATABASE_URL is missing. Configure it in your backend .env file.",
		);
	}

	if (!pool) {
		pool = new Pool({
			connectionString: env.databaseUrl,
			max: 10,
			idleTimeoutMillis: 30000,
			connectionTimeoutMillis: 10000,
			application_name: "erander-backend",
			ssl: env.nodeEnv === "production" ? { rejectUnauthorized: true } : undefined,
		});

		pool.on("error", (error) => {
			console.error("Unexpected idle PostgreSQL client error:", error.message);
		});
	}

	return pool;
}

export async function checkDatabaseConnection() {
	const database = getDatabasePool();
	const result = await database.query("SELECT NOW() AS database_time");

	return result.rows[0];
}

export async function closeDatabaseConnection() {
	if (pool) {
		await pool.end();
		pool = undefined;
	}
}
