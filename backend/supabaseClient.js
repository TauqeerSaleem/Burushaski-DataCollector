import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

function envValue(name) {
  const value = process.env[name]?.trim();

  if (!value || value === "???" || value.startsWith("YOUR_")) {
    return null;
  }

  return value;
}

const supabaseUrl = envValue("SUPABASE_URL") || envValue("VITE_SUPABASE_URL");

const serviceRoleKey = envValue("SUPABASE_SERVICE_ROLE_KEY");
const supabaseKey =
  serviceRoleKey ||
  envValue("SUPABASE_KEY") ||
  envValue("VITE_SUPABASE_ANON_KEY");

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase backend environment variables.");
}

export const hasServiceRoleKey = Boolean(serviceRoleKey);

export const supabase = createClient(supabaseUrl, supabaseKey);
