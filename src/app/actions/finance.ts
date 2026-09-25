"use server";
import { revalidatePath } from "next/cache";
import { requireFinance } from "@/services/finance";
import {
  accountSchema,
  categorySchema,
  transactionSchema,
  recurrenceSchema,
  dateSchema,
} from "@/lib/finance";
import { uuidSchema, type FormState } from "@/lib/validation";
import { categorySuggestions } from "@/lib/category-suggestions";
import { authorizeFinanceWrite } from "@/lib/profile-access";

async function writeContext(form: FormData, ownerOnly = false) {
  const ctx = await requireFinance();
  // Reject stale forms from another tab after the selected context changes.
  authorizeFinanceWrite(
    ctx.role,
    ctx.profile.id,
    form.get("financial_profile_id"),
    ownerOnly,
  );
  return ctx;
}
function failure(error: unknown): FormState {
  if (error instanceof Error && !("code" in error)) {
    // Preserve framework redirects thrown by authentication.
    if ("digest" in error) throw error;
    return { error: error.message };
  }
  const e = error as { code?: string; message?: string };
  console.error("[finance-write]", { code: e.code, message: e.message });
  if (e.code === "23503")
    return {
      error:
        "Este registro está vinculado a movimentações/recorrências, ou a conta/categoria não pertence a este perfil. Preserve o histórico.",
    };
  if (e.code === "23505")
    return { error: "Este registro já existe neste perfil." };
  if (e.code === "23514")
    return {
      error:
        "A operação viola uma regra financeira. Confira datas, tipo e vínculos. Ocorrências recorrentes devem ser canceladas, não excluídas.",
    };
  if (e.code === "42501")
    return { error: "Você não tem permissão para realizar esta ação." };
  if (e.code === "22023")
    return {
      error:
        "Escolha até 366 dias por geração e, no máximo, um ano à frente da data atual.",
    };
  return {
    error: "Não foi possível salvar. Verifique a conexão e tente novamente.",
  };
}
function success(message: string) {
  revalidatePath("/app", "layout");
  return { success: message };
}
function idOf(form: FormData) {
  return uuidSchema.parse(form.get("id"));
}
function confirm(form: FormData) {
  if (form.get("confirmed") !== "yes")
    throw new Error("Confirme a ação antes de continuar.");
}

export async function saveAccount(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const ctx = await writeContext(form);
    const parsed = accountSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { name, institution, kind, opening_balance } = parsed.data;
    const fields = { name, institution, kind, opening_balance };
    const values = {
      ...fields,
      institution: parsed.data.institution || undefined,
    };
    const result = form.get("id")
      ? await ctx.supabase
          .from("accounts")
          .update({ ...values, institution: parsed.data.institution || null })
          .eq("id", idOf(form))
          .eq("financial_profile_id", ctx.profile.id)
          .select("id")
          .single()
      : await ctx.supabase
          .from("accounts")
          .insert({ ...values, financial_profile_id: ctx.profile.id })
          .select("id")
          .single();
    if (result.error) throw result.error;
    return success("Conta salva com sucesso.");
  } catch (e) {
    return failure(e);
  }
}
export async function deleteAccount(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const ctx = await writeContext(form, true);
    confirm(form);
    const { error } = await ctx.supabase
      .from("accounts")
      .delete()
      .eq("id", idOf(form))
      .eq("financial_profile_id", ctx.profile.id)
      .select("id")
      .single();
    if (error) throw error;
    return success("Conta excluída.");
  } catch (e) {
    return failure(e);
  }
}
export async function saveCategory(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const ctx = await writeContext(form);
    const parsed = categorySchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const result = form.get("id")
      ? await ctx.supabase
          .from("transaction_categories")
          .update(parsed.data)
          .eq("id", idOf(form))
          .eq("financial_profile_id", ctx.profile.id)
          .select("id")
          .single()
      : await ctx.supabase
          .from("transaction_categories")
          .insert({ ...parsed.data, financial_profile_id: ctx.profile.id })
          .select("id")
          .single();
    if (result.error) throw result.error;
    return success("Categoria salva com sucesso.");
  } catch (e) {
    return failure(e);
  }
}
export async function deleteCategory(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const ctx = await writeContext(form, true);
    confirm(form);
    const { error } = await ctx.supabase
      .from("transaction_categories")
      .delete()
      .eq("id", idOf(form))
      .eq("financial_profile_id", ctx.profile.id)
      .select("id")
      .single();
    if (error) throw error;
    return success("Categoria excluída.");
  } catch (e) {
    return failure(e);
  }
}
export async function addSuggestions(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const ctx = await writeContext(form);
    const { data: existing, error } = await ctx.supabase
      .from("transaction_categories")
      .select("name,kind")
      .eq("financial_profile_id", ctx.profile.id);
    if (error) throw error;
    const values = categorySuggestions
      .filter(
        (s) => !existing.some((e) => e.name === s.name && e.kind === s.kind),
      )
      .map((s) => ({ ...s, financial_profile_id: ctx.profile.id }));
    if (values.length) {
      const { error } = await ctx.supabase
        .from("transaction_categories")
        .insert(values);
      if (error) throw error;
    }
    return success(`${values.length} categorias adicionadas a este perfil.`);
  } catch (e) {
    return failure(e);
  }
}
async function validateReferences(
  ctx: Awaited<ReturnType<typeof requireFinance>>,
  account: string,
  category: string | null,
  type: string,
  destination: string | null,
) {
  const ids = destination ? [account, destination] : [account];
  const { data: accounts, error } = await ctx.supabase
    .from("accounts")
    .select("id")
    .eq("financial_profile_id", ctx.profile.id)
    .in("id", ids);
  if (error) throw error;
  if (accounts.length !== ids.length)
    throw new Error("Selecione contas deste perfil financeiro.");
  if (category) {
    const { data, error } = await ctx.supabase
      .from("transaction_categories")
      .select("id,kind")
      .eq("financial_profile_id", ctx.profile.id)
      .eq("id", category)
      .single();
    if (error || data?.kind !== type)
      throw new Error(
        "A categoria deve pertencer ao perfil e ao tipo do lançamento.",
      );
  }
}
export async function saveTransaction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const ctx = await writeContext(form);
    const parsed = transactionSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const v = parsed.data;
    await validateReferences(
      ctx,
      v.account_id,
      v.category_id,
      v.type,
      v.destination_account_id,
    );
    const result = form.get("id")
      ? await ctx.supabase
          .from("transactions")
          .update(v)
          .eq("id", idOf(form))
          .eq("financial_profile_id", ctx.profile.id)
          .select("id")
          .single()
      : await ctx.supabase
          .from("transactions")
          .insert({ ...v, financial_profile_id: ctx.profile.id })
          .select("id")
          .single();
    if (result.error) throw result.error;
    return success("Lançamento salvo. Os saldos já foram recalculados.");
  } catch (e) {
    return failure(e);
  }
}
export async function removeTransaction(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const cancel = form.get("operation") === "cancel";
    const ctx = await writeContext(form, !cancel);
    confirm(form);
    const id = idOf(form);
    const result = cancel
      ? await ctx.supabase
          .from("transactions")
          .update({ status: "cancelled" })
          .eq("id", id)
          .eq("financial_profile_id", ctx.profile.id)
          .select("id")
          .single()
      : await ctx.supabase
          .from("transactions")
          .delete()
          .eq("id", id)
          .eq("financial_profile_id", ctx.profile.id)
          .select("id")
          .single();
    if (result.error) throw result.error;
    return success(cancel ? "Lançamento cancelado." : "Lançamento excluído.");
  } catch (e) {
    return failure(e);
  }
}
export async function saveRecurrence(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const ctx = await writeContext(form);
    const parsed = recurrenceSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const v = parsed.data;
    await validateReferences(ctx, v.account_id, v.category_id, v.type, null);
    const { error } = await ctx.supabase
      .from("recurring_transactions")
      .insert({ ...v, financial_profile_id: ctx.profile.id });
    if (error) throw error;
    return success(
      "Recorrência salva. Use “Gerar previsões” para criar os lançamentos pendentes do período.",
    );
  } catch (e) {
    return failure(e);
  }
}
export async function cancelRecurrence(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const ctx = await writeContext(form);
    confirm(form);
    const { error } = await ctx.supabase
      .from("recurring_transactions")
      .update({ active: false })
      .eq("id", idOf(form))
      .eq("financial_profile_id", ctx.profile.id)
      .select("id")
      .single();
    if (error) throw error;
    return success(
      "Recorrência cancelada. Pagamentos concluídos e pendências anteriores a hoje foram preservados.",
    );
  } catch (e) {
    return failure(e);
  }
}
export async function generateOccurrences(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const ctx = await writeContext(form);
    const from = dateSchema.safeParse(form.get("from")),
      to = dateSchema.safeParse(form.get("to"));
    if (!from.success || !to.success || to.data < from.data)
      return { error: "Escolha um intervalo válido." };
    const { data, error } = await ctx.supabase.rpc("materialize_recurring", {
      p_profile: ctx.profile.id,
      p_from: from.data,
      p_to: to.data,
    });
    if (error) throw error;
    return success(
      `${data} lançamentos gerados. Ocorrências existentes foram preservadas.`,
    );
  } catch (e) {
    return failure(e);
  }
}
