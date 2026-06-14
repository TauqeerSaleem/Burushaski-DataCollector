import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase backend environment variables.");
}

export const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

export const supabase = createClient(supabaseUrl, supabaseKey);
