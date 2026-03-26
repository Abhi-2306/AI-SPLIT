/**
 * Creates a test user in Supabase with email pre-confirmed (no confirmation email sent).
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (different from the anon key).
 *
 * Usage:
 *   node scripts/create-test-user.mjs
 *   node scripts/create-test-user.mjs test@example.com mypassword
 *
 * Get your service_role key from:
 *   Supabase dashboard → Project Settings → API → service_role key
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// Read .env.local manually
import { fileURLToPath } from "url";
import { join, dirname } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
let envVars = {};
try {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    envVars[key] = value;
  }
} catch {
  console.error("Could not read .env.local — make sure it exists in the project root.");
  process.exit(1);
}

const SUPABASE_URL = envVars["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_ROLE_KEY = envVars["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing environment variables.\n" +
    "Make sure .env.local contains:\n" +
    "  NEXT_PUBLIC_SUPABASE_URL=...\n" +
    "  SUPABASE_SERVICE_ROLE_KEY=...   ← get this from Supabase dashboard → Settings → API\n"
  );
  process.exit(1);
}

const email = process.argv[2] ?? "test@aisplit.dev";
const password = process.argv[3] ?? "testpass123";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true, // skip confirmation email
});

if (error) {
  if (error.message.includes("already been registered")) {
    console.log(`User ${email} already exists. You can log in with password: ${password}`);
  } else {
    console.error("Error creating user:", error.message);
    process.exit(1);
  }
} else {
  console.log(`\nTest user created successfully!\n`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`\nNo email confirmation needed — log in at http://localhost:3000/login\n`);
}
