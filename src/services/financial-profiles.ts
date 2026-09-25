import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { requireUser } from "./session";
export const getProfileContext = cache(async () => {
  const { supabase, user } = await requireUser();
  const [{ data: profiles, error }, { data: personal, error: personalError }] =
    await Promise.all([
      supabase.from("financial_profiles").select("*").order("created_at"),
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    ]);
  if (error || personalError) {
    // Log database diagnostics only; never session cookies, tokens or user data.
    for (const [table, failure] of [["financial_profiles", error], ["profiles", personalError]] as const) {
      if (failure) console.error("[profile-context]", { table, code: failure.code, message: failure.message });
    }
    throw new Error(
      "Não foi possível carregar seus perfis. Verifique a conexão e a migration do Supabase.",
    );
  }
  const selected = (await cookies()).get("financial_profile_id")?.value;
  const active = profiles.find((p) => p.id === selected) ?? profiles[0] ?? null;
  return { profiles, active, userName: personal.full_name };
});
