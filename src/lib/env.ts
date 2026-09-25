export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error("Configure as variáveis do Supabase no .env.local.");
  if (!key.startsWith("sb_publishable_"))
    throw new Error("Utilize somente a chave pública publishable do Supabase.");
  return { url, key };
}
export function appUrl() {
  const value = process.env.APP_URL;
  if (!value) throw new Error("Configure APP_URL.");
  const url = new URL(value);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("APP_URL deve usar HTTPS em produção.");
  return url.origin;
}
