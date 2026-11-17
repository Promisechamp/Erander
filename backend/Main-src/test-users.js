import "dotenv/config";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "./config/supabase.js";

if (!supabaseAdmin) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");
}

const PASSWORD = "uche6666";
const TOTAL_USERS = 50;
const ERANDER_COUNT = 25;

const firstNames = [
  "Uche", "David", "Chinedu", "Amaka", "Emeka",
  "Grace", "Daniel", "Ada", "Samuel", "Chioma",
  "Michael", "Esther", "John", "Blessing", "Ifeanyi",
  "Joy", "Peter", "Ngozi", "Paul", "Ruth",
  "Victor", "Faith", "Ibrahim", "Sarah", "Kelechi"
];

const lastNames = [
  "Okafor", "Eze", "Nwosu", "Agu", "Obi",
  "Bello", "James", "Musa", "Okoro", "Adeyemi",
  "Onyeka", "Okeke", "Ibrahim", "Olawale", "Dike"
];

const randomItem = (array) =>
  array[Math.floor(Math.random() * array.length)];

async function createTestUsers() {
  const users = [];

  for (let i = 1; i <= TOTAL_USERS; i++) {
    const firstName = randomItem(firstNames);
    const lastName = randomItem(lastNames);

    const role = i <= ERANDER_COUNT ? "erander" : "customer";

    const email = `erander.test.${randomUUID()}@example.com`;

    const { data, error } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName
        }
      });

    if (error) {
      console.error(`Failed to create ${email}:`, error.message);
      continue;
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        user_roles: [role]
      })
      .eq("id", data.user.id);

    if (profileError) {
      console.error(
        `Profile update failed for ${email}:`,
        profileError.message
      );
    }

    users.push({
      id: data.user.id,
      email,
      password: PASSWORD,
      first_name: firstName,
      last_name: lastName,
      role
    });

    console.log(`Created ${i}/${TOTAL_USERS}: ${email} (${role})`);
  }

  console.log("\n===== RESULTS =====");
  console.log(`Total created: ${users.length}`);
  console.log(`Eranders: ${users.filter(u => u.role === "erander").length}`);
  console.log(`Customers: ${users.filter(u => u.role === "customer").length}`);

  console.table(users);
}

createTestUsers();