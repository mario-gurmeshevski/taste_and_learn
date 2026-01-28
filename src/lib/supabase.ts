import { createClient } from "@supabase/supabase-js";
import { cookieStorageAdapter } from "./cookieStorageAdapter";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: cookieStorageAdapter,
  },
});

export default supabase;
