"use server";
import { revalidatePath } from "next/cache";
import { requireFinance } from "@/services/finance";
import { authorizeFinanceWrite } from "@/lib/profile-access";
import { uuidSchema, type FormState } from "@/lib/validation";
import {
  cardSchema,
  positionSchema,
  itemSchema,
  purchaseSchema,
  movementSchema,
} from "@/lib/wealth";
import { dateSchema, today } from "@/lib/finance";
async function context(form: FormData, owner = false) {
  const ctx = await requireFinance();
  authorizeFinanceWrite(
    ctx.role,
    ctx.profile.id,
    form.get("financial_profile_id"),
    owner,
  );
  return ctx;
}
function confirmed(form: FormData) {
  if (form.get("confirmed") !== "yes")
    throw new Error("Confirme a operação antes de continuar.");
}
function done(message: string): FormState {
  revalidatePath("/app", "layout");
  return { success: message };
}
function failure(e: unknown): FormState {
  if (e instanceof Error && "digest" in e) throw e;
  const err = e as { code?: string; message?: string };
  if (!err.code)
    return { error: err.message ?? "Confira os dados informados." };
  console.error("[wealth-write]", { code: err.code, message: err.message });
  const messages: Record<string, string> = {
    "Insufficient card limit": "A compra ultrapassa o limite disponível.",
    "Invoice already paid":
      "Esta competência já foi paga. Confira a data da compra.",
    "Paid installments cannot be cancelled":
      "Esta compra já tem parcela paga e não pode ser cancelada.",
    "Insufficient position balance":
      "O valor da retirada é maior que o saldo disponível.",
    "Withdraw balance before archiving":
      "Retire o saldo da posição antes de arquivá-la.",
    "Cycle with history is immutable":
      "O ciclo não pode ser alterado em cartão com histórico.",
    "Limit below committed amount":
      "O limite não pode ser menor que o valor comprometido.",
    "Goal target not reached": "A meta ainda não atingiu o valor alvo.",
    "Movement must follow history and cannot be future":
      "Use uma data igual ou posterior à última movimentação, até hoje.",
    "Pay only after closing, with no future date":
      "Registre o pagamento após o fechamento e sem data futura.",
  };
  return {
    error:
      messages[err.message ?? ""] ??
      (err.code === "42501"
        ? "Acesso não autorizado para este registro."
        : err.code === "23503"
          ? "Conta ou categoria inválida para este perfil."
          : err.code === "23505"
            ? "Este registro já existe."
            : err.code === "23514"
              ? "A operação viola uma regra financeira. Confira valores, datas e campos."
              : "Não foi possível concluir. Confira a conexão e a ativação da Fase 4."),
  };
}
export async function saveWealth(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const entity = form.get("entity");
    const archive =
      form.get("active") === "false" || form.get("status") === "archived";
    const ctx = await context(form, archive);
    if (archive) confirmed(form);
    const raw = Object.fromEntries(form);
    const parsed =
      entity === "card"
        ? cardSchema.safeParse(raw)
        : entity === "position"
          ? positionSchema.safeParse(raw)
          : entity === "item"
            ? itemSchema.safeParse(raw)
            : null;
    if (!parsed?.success)
      return { error: parsed?.error.issues[0].message ?? "Registro inválido." };
    const { error } = await ctx.supabase.rpc("wealth_save", {
      p_profile: ctx.profile.id,
      p_entity: String(entity),
      p_id: form.get("id") ? uuidSchema.parse(form.get("id")) : null,
      p_data: parsed.data,
    });
    if (error) throw error;
    return done("Registro salvo.");
  } catch (e) {
    return failure(e);
  }
}
export async function registerPurchase(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const ctx = await context(form);
    const p = purchaseSchema.safeParse(Object.fromEntries(form));
    if (!p.success) return { error: p.error.issues[0].message };
    const v = p.data;
    const { error } = await ctx.supabase.rpc("wealth_purchase", {
      p_profile: ctx.profile.id,
      p_card: v.card_id,
      p_category: v.category_id,
      p_description: v.description,
      p_amount: v.amount,
      p_date: v.purchase_date,
      p_count: v.installment_count,
      p_kind: v.expense_kind,
      p_notes: v.notes,
      p_request: v.request_id,
    });
    if (error) throw error;
    return done(
      "Compra registrada. As parcelas foram distribuídas nas faturas.",
    );
  } catch (e) {
    return failure(e);
  }
}
export async function cancelPurchase(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const ctx = await context(form, true);
    confirmed(form);
    const { error } = await ctx.supabase.rpc("wealth_cancel_purchase", {
      p_profile: ctx.profile.id,
      p_purchase: uuidSchema.parse(form.get("id")),
    });
    if (error) throw error;
    return done("Compra cancelada. Histórico preservado e limite liberado.");
  } catch (e) {
    return failure(e);
  }
}
export async function payInvoice(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const ctx = await context(form, true);
    confirmed(form);
    const date = dateSchema.parse(form.get("payment_date"));
    if (date > today())
      return { error: "O pagamento não pode ter data futura." };
    const { error } = await ctx.supabase.rpc("wealth_pay_invoice", {
      p_profile: ctx.profile.id,
      p_invoice: uuidSchema.parse(form.get("id")),
      p_account: uuidSchema.parse(form.get("account_id")),
      p_date: date,
    });
    if (error) throw error;
    return done(
      "Pagamento registrado no controle financeiro. Nenhum dinheiro foi movimentado fora do aplicativo.",
    );
  } catch (e) {
    return failure(e);
  }
}
export async function movePosition(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const ctx = await context(form);
    const p = movementSchema.safeParse(Object.fromEntries(form));
    if (!p.success) return { error: p.error.issues[0].message };
    const v = p.data;
    const { error } = await ctx.supabase.rpc("wealth_move", {
      p_profile: ctx.profile.id,
      p_position: v.position_id,
      p_kind: v.kind,
      p_amount: v.amount,
      p_account: v.account_id || null,
      p_date: v.movement_date,
      p_notes: v.notes,
      p_request: v.request_id,
    });
    if (error) throw error;
    return done("Movimentação registrada no histórico e nos saldos.");
  } catch (e) {
    return failure(e);
  }
}
export async function saveSnapshot(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  try {
    const ctx = await context(form);
    const { error } = await ctx.supabase.rpc("wealth_snapshot", {
      p_profile: ctx.profile.id,
    });
    if (error) throw error;
    return done("Posição patrimonial de hoje registrada.");
  } catch (e) {
    return failure(e);
  }
}
