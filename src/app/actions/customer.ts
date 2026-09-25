"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFinance } from "@/services/finance";
import { authorizeFinanceWrite } from "@/lib/profile-access";
import { dateSchema, positiveMoney, today } from "@/lib/finance";
import { uuidSchema, type FormState } from "@/lib/validation";
import { widgetIds, type ImportResult, type WidgetId } from "@/types/customer";

function fail(error: unknown): FormState {
  if (error instanceof Error && !("code" in error)) {
    if ("digest" in error) throw error;
    return { error: error.message };
  }
  const e = error as { code?: string; message?: string };
  console.error("[customer-value-write]", { code: e.code, message: e.message });
  if (e.code === "42501") return { error: "Você não tem permissão para realizar esta ação." };
  if (e.code === "23503") return { error: "A conta ou categoria não pertence ao perfil selecionado." };
  if (e.code === "22023") return { error: "O arquivo contém uma linha inválida. Revise a prévia e tente novamente." };
  return { error: "Não foi possível salvar. Confira a conexão e tente novamente." };
}
async function context(form: FormData, write = true) {
  const ctx = await requireFinance();
  const submitted = form.get("financial_profile_id");
  if (submitted !== ctx.profile.id) throw new Error("O perfil mudou em outra aba. Recarregue a página.");
  if (write) authorizeFinanceWrite(ctx.role, ctx.profile.id, submitted);
  return ctx;
}
export async function saveDashboardPreferences(_: FormState, form: FormData): Promise<FormState> {
  try {
    const ctx = await context(form, false);
    const widgets = [...new Set(form.getAll("widgets").filter((v): v is WidgetId => typeof v === "string" && widgetIds.includes(v as WidgetId)))];
    if (!widgets.length) return { error: "Mantenha pelo menos um indicador no painel." };
    const { error } = await ctx.supabase.from("dashboard_preferences").upsert({ financial_profile_id: ctx.profile.id, user_id: (await ctx.supabase.auth.getUser()).data.user!.id, widget_order: widgets }, { onConflict: "financial_profile_id,user_id" });
    if (error) throw error;
    revalidatePath("/app", "layout");
    return { success: "Painel personalizado." };
  } catch (error) { return fail(error); }
}
const subscriptionSchema = z.object({
  description: z.string().trim().min(2).max(160), merchant_name: z.string().trim().max(100),
  service_url: z.union([z.url("Informe uma URL válida."), z.literal("")]), amount: positiveMoney,
  account_id: z.uuid(), category_id: z.uuid(), frequency: z.enum(["weekly","monthly","bimonthly","quarterly","semiannual","annual"]),
  due_day: z.coerce.number().int().min(1).max(31), start_date: dateSchema,
  renewal_notice_days: z.coerce.number().int().min(0).max(60), notes: z.string().trim().max(2000),
});
export async function saveSubscription(_: FormState, form: FormData): Promise<FormState> {
  try {
    const ctx = await context(form);
    const parsed = subscriptionSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const v = parsed.data;
    const [account, category] = await Promise.all([
      ctx.supabase.from("accounts").select("id").eq("financial_profile_id",ctx.profile.id).eq("id",v.account_id).single(),
      ctx.supabase.from("transaction_categories").select("id").eq("financial_profile_id",ctx.profile.id).eq("id",v.category_id).eq("kind","expense").single(),
    ]);
    if (account.error || category.error) throw { code: "23503", message: "Invalid reference" };
    const { error } = await ctx.supabase.from("recurring_transactions").insert({
      financial_profile_id: ctx.profile.id, account_id: v.account_id, category_id: v.category_id, type: "expense",
      description: v.description, amount: v.amount, frequency: v.frequency, due_day: v.due_day, start_date: v.start_date,
      end_date: null, notes: v.notes, expense_kind: "fixed", is_subscription: true, merchant_name: v.merchant_name,
      service_url: v.service_url, renewal_notice_days: v.renewal_notice_days,
    });
    if (error) throw error;
    revalidatePath("/app", "layout");
    return { success: "Assinatura adicionada. Gere as previsões para incluí-la no fluxo de caixa." };
  } catch (error) { return fail(error); }
}
export async function cancelSubscription(_: FormState, form: FormData): Promise<FormState> {
  try {
    const ctx = await context(form);
    if (form.get("confirmed") !== "yes") return { error: "Confirme o cancelamento." };
    const id = uuidSchema.parse(form.get("id"));
    const { error } = await ctx.supabase.from("recurring_transactions").update({active:false}).eq("financial_profile_id",ctx.profile.id).eq("id",id).eq("is_subscription",true).select("id").single();
    if (error) throw error;
    revalidatePath("/app", "layout");
    return { success: "Assinatura cancelada; o histórico foi preservado." };
  } catch (error) { return fail(error); }
}
const importRows = z.array(z.object({ date: dateSchema.refine((date)=>date<=today(),"A importação não aceita lançamentos futuros."), description: z.string().trim().min(2).max(160), amount: positiveMoney, type: z.enum(["income","expense"]) })).min(1).max(500);
export async function importTransactions(_: FormState, form: FormData): Promise<FormState & { result?: ImportResult }> {
  try {
    const ctx = await context(form);
    if (form.get("confirmed") !== "yes") return { error: "Revise a prévia e confirme a importação." };
    const fileName = z.string().trim().min(1).max(180).parse(form.get("file_name"));
    const format = z.enum(["csv","ofx"]).parse(form.get("source_format"));
    const raw = z.string().max(500000).parse(form.get("rows"));
    const rows = importRows.parse(JSON.parse(raw));
    const account = uuidSchema.parse(form.get("account_id"));
    const income = uuidSchema.parse(form.get("income_category_id"));
    const expense = uuidSchema.parse(form.get("expense_category_id"));
    const { data, error } = await ctx.supabase.rpc("finance_import_transactions", { p_profile: ctx.profile.id, p_account: account, p_income_category: income, p_expense_category: expense, p_file_name: fileName, p_format: format, p_rows: rows });
    if (error) throw error;
    revalidatePath("/app", "layout");
    return { success: `${data.imported} lançamentos importados; ${data.duplicates} duplicados ignorados.`, result: data };
  } catch (error) { return fail(error); }
}
