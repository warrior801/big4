import { createClient } from '@supabase/supabase-js';

// The same Supabase project as Ironframe, so the login is shared. The publishable key is
// meant to live in app code: it can't read anything without the login, because every
// str_ table only returns rows belonging to the signed-in user.
const SUPABASE_URL = 'https://fakuiaxnnawjmqoqpxmn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_p0fVftZyYXwJBw4fjmUsJA_1vdqvSY_';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true, // stay signed in on this phone
    autoRefreshToken: true,
    detectSessionInUrl: false, // password login only, never a magic link
  },
});
