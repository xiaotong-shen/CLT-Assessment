/**
 * Creates the first admin user.
 * Run once: pnpm seed:admin
 */
import "./load-env"; // loads .env.local before anything else
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import bcrypt from "bcryptjs";
import * as readline from "readline";
import { users } from "../db/schema";

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = postgres(databaseUrl, { max: 1 });
const db = drizzle(client);

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const email = await prompt("Admin email: ");
  const password = await prompt("Admin password: ");

  if (!email || !password) {
    console.error("Email and password required.");
    process.exit(1);
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    console.log(`User ${email} already exists. Updating password and role.`);
    const hash = await bcrypt.hash(password, 12);
    await db.update(users)
      .set({ role: "admin", image: hash })
      .where(eq(users.email, email));
    console.log("Updated.");
  } else {
    const hash = await bcrypt.hash(password, 12);
    await db.insert(users).values({
      id: createId(),
      email,
      role: "admin",
      image: hash, // password hash stored in image column for MVP
    });
    console.log(`Admin user ${email} created.`);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
