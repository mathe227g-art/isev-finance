"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/env";
import {
  emailSchema,
  passwordSchema,
  signupSchema,
  type FormState,
} from "@/lib/validation";
import { cookies } from "next/headers";
export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(form.get("email"));
  const password = form.get("password");
  if (
    !email.success ||
    typeof password !== "string" ||
    !password ||
    password.length > 128
  )
    return { error: "Informe um e-mail e uma senha válidos." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password,
  });
  if (error) {
    console.error("[auth-login]", {
      name: error.name,
      code: error.code,
      status: error.status,
    });
    if (error.name === "AuthRetryableFetchError" || error.status === 0 || (error.status ?? 0) >= 500)
      return { error: "Não foi possível conectar ao serviço de autenticação. Tente novamente em instantes." };
    if (error.status === 429)
      return { error: "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente." };
    return {
      error:
        "Não foi possível entrar. Verifique e-mail, senha e confirmação do e-mail.",
    };
  }
  redirect("/app");
}
export async function signInWithGoogle(): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: appUrl() + "/auth/confirm?next=/app",
    },
  });
  if (error || !data.url) {
    console.error("[auth-google]", {
      name: error?.name,
      code: error?.code,
      status: error?.status,
    });
    redirect("/login?notice=oauth");
  }
  redirect(data.url);
}
export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: appUrl() + "/auth/confirm",
    },
  });
  if (error)
    return {
      error:
        "Não foi possível concluir o cadastro. Tente novamente em alguns instantes.",
    };
  if (data.session) redirect("/app");
  return {
    success:
      "Confira sua caixa de entrada para confirmar o e-mail e acessar sua conta. Se já possui uma conta, use o login ou recupere sua senha.",
  };
}
export async function recover(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = emailSchema.safeParse(form.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  // Deliberately identical response for registered/unregistered addresses.
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: appUrl() + "/auth/confirm?next=/nova-senha",
  });
  if (error && (error.name === "AuthRetryableFetchError" || error.status === 0 || (error.status ?? 0) >= 500))
    return { error: "O serviço está temporariamente indisponível. Tente novamente em instantes." };
  if (error?.status === 429)
    return { error: "Aguarde alguns minutos antes de solicitar outro link." };
  return {
    success:
      "Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha. Aguarde alguns minutos e confira o spam.",
  };
}
export async function changePassword(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = passwordSchema.safeParse(form.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data !== form.get("confirm"))
    return { error: "As senhas não coincidem." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { error: "O link expirou. Solicite uma nova recuperação de senha." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error)
    return {
      error:
        "Não foi possível atualizar. Use uma senha diferente ou solicite um novo link.",
    };
  await supabase.auth.signOut({ scope: "global" });
  (await cookies()).delete("financial_profile_id");
  redirect("/login?notice=password");
}
export async function logout(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error)
    throw new Error("Não foi possível encerrar a sessão. Tente novamente.");
  (await cookies()).delete("financial_profile_id");
  redirect("/login?notice=logout");
}
