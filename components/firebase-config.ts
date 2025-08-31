import { createClient } from '@supabase/supabase-js';

// --- Supabase Configuration ---
// IMPORTANT: To enable the real-time Student-Teacher Portal, you need a Supabase project.
//
// 1. Go to the Supabase dashboard: https://app.supabase.com/
// 2. Click "New project" and create one.
// 3. In your new project, go to Project Settings (gear icon ⚙️) > API.
// 4. Under "Project API keys", you will find your Project URL and your `anon` `public` key.
// 5. Copy these values and paste them below, replacing the placeholder values.
// 6. Go to the "Table Editor" in your Supabase project and run the SQL queries
//    provided in the on-screen error message to set up the necessary tables.
//
// After configuring this, the portal will be fully functional!

const supabaseUrl = 'https://djgnzprigxgbloruuayw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqZ256cHJpZ3hnYmxvcnV1YXl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2MTk5MDgsImV4cCI6MjA3MjE5NTkwOH0.sbFsHtBPNhi-4-ZJ90w-4SYl49lesWhzXKHuwTRz2hc';

let supabase: ReturnType<typeof createClient> | null = null;

const isUrlPlaceholder = supabaseUrl.includes('YOUR_SUPABASE_URL');
const isKeyPlaceholder = supabaseAnonKey.includes('YOUR_SUPABASE_ANON_KEY');

if (!isUrlPlaceholder && !isKeyPlaceholder) {
    try {
        supabase = createClient(supabaseUrl, supabaseAnonKey);
    } catch (e) {
        console.error("Supabase initialization error:", e);
        supabase = null;
    }
} else {
    let warning = "Supabase is not configured. ";
    if (isUrlPlaceholder) {
        warning += "Project URL is missing. ";
    }
    if (isKeyPlaceholder) {
        warning += "Anon key is missing. ";
    }
    warning += "Please add your credentials to components/firebase-config.ts to enable the real-time portal.";
    console.warn(warning);
}

export { supabase };