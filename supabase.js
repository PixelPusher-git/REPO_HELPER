// supabase.js
// Вставь сюда свои значения из Project Settings → API
const SUPABASE_URL = 'https://noixytxiokaagwvtfbfd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9yg6XrL_jyulbNQa3Xt0oA_a3fALhs5';

// Создаём клиент и делаем его глобальным
window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('Supabase initialized:', !!window.supabase);
