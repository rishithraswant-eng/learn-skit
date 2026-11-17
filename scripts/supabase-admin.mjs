// Modern secret keys go in apikey; only legacy JWT keys belong in Bearer auth.
export function adminHeaders(key) {
  if (!key) throw Error('A local Supabase admin key is required.');
  if (key.startsWith('sb_secret_')) return { apikey:key };
  return { apikey:key, Authorization:`Bearer ${key}` };
}
