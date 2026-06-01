import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Helpful message for setup time — these come from the .env file.
  console.error(
    'Missing Supabase env vars. Make sure VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY are set in your .env file, then restart `npm run dev`.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // We use 6-digit email OTP codes (verifyOtp), not link redirects, so the
    // session is created in-app. This keeps login working inside the installed
    // iPhone PWA, which has separate storage from Safari.
    detectSessionInUrl: false,
  },
})
