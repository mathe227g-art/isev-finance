"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/services/session";
import { profileSchema, uuidSchema, type FormState } from "@/lib/validation";
async function selectCookie(id: string) {
  (await cookies()).set("financial_profile_id", id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
export async function createProfile(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("financial_profiles")
    .insert({ ...parsed.data, owner_id: user.id })
    .select("id")
    .single();
  if (error)
    return {
      error:
        "Não foi possível criar o perfil. Verifique a conexão e tente novamente.",
    };
  await selectCookie(data.id);
  revalidatePath("/app", "layout");
  redirect("/app?created=1");
}
export async function switchProfile(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = uuidSchema.safeParse(form.get("financial_profile_id"));
  if (!parsed.success) return { error: "Selecione um perfil válido." };
  const { supabase } = await requireUser();
  // RLS verifies membership. The cookie alone never authorizes access.
  const { data, error } = await supabase
    .from("financial_profiles")
    .select("id")
    .eq("id", parsed.data)
    .maybeSingle();
  if (error || !data)
    return { error: "Perfil indisponível ou acesso não autorizado." };
  await selectCookie(data.id);
  revalidatePath("/app", "layout");
  redirect("/app?profile=" + data.id);
}

export async function deleteFinancialProfile(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  if (form.get("confirmed") !== "yes")
    return { error: "Confirme a exclusão do perfil." };
  const parsed = uuidSchema.safeParse(form.get("id"));
  if (!parsed.success) return { error: "Perfil inválido." };
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("financial_profiles")
    .delete()
    .eq("id", parsed.data)
    .eq("owner_id", user.id);
  if (error) {
    console.error("[profile-delete]", {
      code: error.code,
      message: error.message,
    });
    return { error: "Não foi possível excluir o perfil e seus dados." };
  }
  const jar = await cookies();
  if (jar.get("financial_profile_id")?.value === parsed.data)
    jar.delete("financial_profile_id");
  revalidatePath("/app", "layout");
  redirect("/app/perfis?deleted=1");
}
