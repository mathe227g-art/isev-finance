"use server";
import { revalidatePath } from "next/cache";
import { requireFinance } from "@/services/finance";
import { authorizeFinanceWrite } from "@/lib/profile-access";
import { budgetSchema } from "@/lib/insights";
import { uuidSchema, type FormState } from "@/lib/validation";
function failure(e: unknown): FormState {
  if (e instanceof Error && "digest" in e) throw e;
  const error = e as { code?: string; message?: string };
  if (error.code)
    console.error("[budget-write]", {
      code: error.code,
      message: error.message,
    });
  if (error.code === "23505")
    return {
      error:
        "Esta categoria já tem orçamento neste mês. Edite o orçamento existente.",
    };
  if (error.code === "23503")
    return { error: "Selecione uma categoria de despesa deste perfil." };
  if (error.code === "42501")
    return { error: "Você não tem permissão para esta ação." };
  return {
    error: error.code
      ? "Não foi possível salvar o orçamento. Verifique a conexão e a ativação da Fase 3."
      : (error.message ?? "Dados inválidos."),
  };
}
export async function saveBudget(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const ctx = await requireFinance();
    authorizeFinanceWrite(
      ctx.role,
      ctx.profile.id,
      form.get("financial_profile_id"),
    );
    const parsed = budgetSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const v = parsed.data;
    const { data: category, error } = await ctx.supabase
      .from("transaction_categories")
      .select("id")
      .eq("financial_profile_id", ctx.profile.id)
      .eq("id", v.category_id)
      .eq("kind", "expense")
      .single();
    if (error || !category)
      return { error: "Selecione uma categoria de despesa deste perfil." };
    const result = form.get("id")
      ? await ctx.supabase
          .from("monthly_budgets")
          .update({ amount: v.amount })
          .eq("id", uuidSchema.parse(form.get("id")))
          .eq("financial_profile_id", ctx.profile.id)
          .eq("category_id", v.category_id)
          .eq("month", v.month)
          .select("id")
          .single()
      : await ctx.supabase
          .from("monthly_budgets")
          .insert({ ...v, financial_profile_id: ctx.profile.id })
          .select("id")
          .single();
    if (result.error) throw result.error;
    revalidatePath("/app", "layout");
    return { success: "Orçamento salvo." };
  } catch (e) {
    return failure(e);
  }
}
export async function deleteBudget(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const ctx = await requireFinance();
    authorizeFinanceWrite(
      ctx.role,
      ctx.profile.id,
      form.get("financial_profile_id"),
      true,
    );
    if (form.get("confirmed") !== "yes")
      return { error: "Confirme a exclusão." };
    const { error } = await ctx.supabase
      .from("monthly_budgets")
      .delete()
      .eq("id", uuidSchema.parse(form.get("id")))
      .eq("financial_profile_id", ctx.profile.id)
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath("/app", "layout");
    return {
      success: "Orçamento excluído. Seus lançamentos foram preservados.",
    };
  } catch (e) {
    return failure(e);
  }
}
export async function classifyRecurrence(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const ctx = await requireFinance();
    authorizeFinanceWrite(
      ctx.role,
      ctx.profile.id,
      form.get("financial_profile_id"),
    );
    const kind = form.get("expense_kind");
    if (kind !== "fixed" && kind !== "variable")
      return { error: "Classificação inválida." };
    const { error } = await ctx.supabase
      .from("recurring_transactions")
      .update({ expense_kind: kind })
      .eq("id", uuidSchema.parse(form.get("id")))
      .eq("financial_profile_id", ctx.profile.id)
      .eq("type", "expense")
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath("/app", "layout");
    return {
      success:
        "Classificação atualizada para novas ocorrências. Lançamentos existentes mantêm sua classificação.",
    };
  } catch (e) {
    return failure(e);
  }
}
