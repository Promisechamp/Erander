import { checkDatabaseConnection, closeDatabaseConnection } from "./src/config/database.js";

try {
  const result = await checkDatabaseConnection();
  console.log("✅ Supabase connected successfully!");
  console.log("Database time:", result.database_time);
} catch (error) {
  console.error("❌ Database connection failed:", error.message);
  process.exitCode = 1;
} finally {
  await closeDatabaseConnection();
}
