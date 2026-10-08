// Fake data until Supabase is ready, and as a demo fallback if it breaks.
// On when NEXT_PUBLIC_USE_MOCK_DATA=true or when the Supabase keys are missing.
export const MOCK_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true" ||
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
