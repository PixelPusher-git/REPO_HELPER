// supabase.js
const SUPABASE_URL = window.__env.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.__env.SUPABASE_ANON_KEY;

window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("Supabase initialized:", !!window.supabase);

