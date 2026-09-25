"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFinance } from "@/services/finance";
import { authorizeFinanceWrite } from "@/lib/profile-access";
import { dateSchema, positiveMoney, today } from "@/lib/finance";
import { emailSchema, uuidSchema, type FormState } from "@/lib/validation";

function failure(error: unknown): FormState {
  if (error instanceof Error && !("code" in error)) {
    if ("digest" in error) throw error;
    return { error: error.message };
  }
  const value = error as { code?: string; message?: string };
  console.error("[business-write]", { code: value.code, message: value.message });
  if (value.code === "42501") return { error: "Somente o proprietário pode realizar esta ação." };
  if (value.code === "23503") return { error: "A conta, categoria ou contato não pertence ao perfil selecionado." };
  if (value.code === "22023") return { error: "Não encontramos uma conta confirmada com esse e-mail ou os dados são inválidos." };
  return { error: "Não foi possível salvar. Confira a conexão e tente novamente." };
}
async function context(form: FormData, ownerOnly = false) {
  const ctx = await requireFinance();
  if (ctx.profile.kind !== "CNPJ") throw new Error("Este recurso está disponível para perfis CNPJ.");
  authorizeFinanceWrite(ctx.role, ctx.profile.id, form.get("financial_profile_id"), ownerOnly);
  return ctx;
}
const contactSchema = z.object({
  kind: z.enum(["client", "supplier", "both"]),
  name: z.string().trim().min(2, "Informe o nome.").max(120),
  document: z.string().trim().max(30),
  email: z.union([emailSchema, z.literal("")]),
  phone: z.string().trim().max(30),
  notes: z.string().trim().max(2000),
});
export async function saveBusinessContact(_: FormState, form: FormData): Promise<FormState> {
  try {
    const ctx = await context(form);
    const parsed = contactSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const id = form.get("id");
    const query = id
      ? ctx.supabase.from("business_contacts").update(parsed.data).eq("financial_profile_id", ctx.profile.id).eq("id", uuidSchema.parse(id)).select("id").single()
      : ctx.supabase.from("business_contacts").insert({ financial_profile_id: ctx.profile.id, ...parsed.data }).select("id").single();
    const { error } = await query;
    if (error) throw error;
    revalidatePath("/app", "layout");
    return { success: id ? "Contato atualizado." : "Contato adicionado." };
  } catch (error) { return failure(error); }
}
const receivableSchema = z.object({
  contact_id: z.uuid(), account_id: z.uuid(), category_id: z.uuid(),
  description: z.string().trim().min(2, "Informe a descrição.").max(160),
  amount: positiveMoney, issue_date: dateSchema.refine((value) => value <= today(), "A emissão não pode estar no futuro."),
  due_date: dateSchema, notes: z.string().trim().max(2000),
});
export async function saveBusinessReceivable(_: FormState, form: FormData): Promise<FormState> {
  try {
    const ctx = await context(form);
    const parsed = receivableSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    if (parsed.data.due_date < parsed.data.issue_date) return { error: "O vencimento não pode ser anterior à emissão." };
    const v = parsed.data;
    const [contact, account, category] = await Promise.all([
      ctx.supabase.from("business_contacts").select("id").eq("financial_profile_id", ctx.profile.id).eq("id", v.contact_id).in("kind", ["client", "both"]).eq("active", true).single(),
      ctx.supabase.from("accounts").select("id").eq("financial_profile_id", ctx.profile.id).eq("id", v.account_id).single(),
      ctx.supabase.from("transaction_categories").select("id").eq("financial_profile_id", ctx.profile.id).eq("id", v.category_id).eq("kind", "income").single(),
    ]);
    if (contact.error || account.error || category.error) throw { code: "23503", message: "Invalid business reference" };
    const { error } = await ctx.supabase.from("transactions").insert({
      financial_profile_id: ctx.profile.id, contact_id: v.contact_id, account_id: v.account_id,
      destination_account_id: null, category_id: v.category_id, type: "income", description: v.description,
      amount: v.amount, transaction_date: v.issue_date, due_date: v.due_date, status: "pending", notes: v.notes,
    });
    if (error) throw error;
    revalidatePath("/app", "layout");
    return { success: "Conta a receber adicionada." };
  } catch (error) { return failure(error); }
}
export async function addProfileMember(_: FormState, form: FormData): Promise<FormState> {
  try {
    const ctx = await context(form, true);
    const email = emailSchema.parse(form.get("email"));
    const role = z.enum(["viewer", "editor"]).parse(form.get("role"));
    const { error } = await ctx.supabase.rpc("profile_add_member_by_email", { p_profile: ctx.profile.id, p_email: email, p_role: role });
    if (error) throw error;
    revalidatePath("/app", "layout");
    return { success: "Acesso concedido." };
  } catch (error) { return failure(error); }
}
export async function removeProfileMember(_: FormState, form: FormData): Promise<FormState> {
  try {
    const ctx = await context(form, true);
    if (form.get("confirmed") !== "yes") return { error: "Confirme a remoção." };
    const user = uuidSchema.parse(form.get("id"));
    const { error } = await ctx.supabase.rpc("profile_remove_member", { p_profile: ctx.profile.id, p_user: user });
    if (error) throw error;
    revalidatePath("/app", "layout");
    return { success: "Acesso removido." };
  } catch (error) { return failure(error); }
}
