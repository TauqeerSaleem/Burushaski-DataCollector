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

export const hasServiceRoleKey = Boolean(serviceRoleKey);
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);

function safeUrlPart(url, part) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return part === "host" ? parsed.host : parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export const supabaseHost = safeUrlPart(supabaseUrl, "host");
const normalizedSupabaseUrl = safeUrlPart(supabaseUrl, "url");
export const supabaseRestUrl = normalizedSupabaseUrl
  ? `${normalizedSupabaseUrl}/rest/v1/`
  : null;

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseKey)
  : null;
