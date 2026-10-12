import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseUrl,
  getSupabaseAnonKey,
  isSupabaseConfigured,
} from "./env";

const url = getSupabaseUrl();
const key = getSupabaseAnonKey();

export const isConfigured = isSupabaseConfigured();

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  key || "placeholder-anon-key"
);