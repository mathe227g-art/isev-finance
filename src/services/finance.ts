import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getProfileContext } from "./financial-profiles";
import { requireUser } from "./session";
import { dateSchema, monthRange } from "@/lib/finance";
import type { Filters } from "@/types/finance";

export const requireFinance = cache(async () => {
  const context = await getProfileContext();
  if (!context.active) redirect("/app/perfis/novo");
  const { supabase, user } = await requireUser();
  const { data: member, error } = await supabase
    .from("financial_profile_members")
    .select("role")
    .eq("financial_profile_id", context.active.id)
    .eq("user_id", user.id)
    .single();
  if (error || !member)
    throw new Error("Não foi possível validar o acesso ao perfil selecionado.");
  return {
    supabase,
    profile: context.active,
    role: member.role,
    userName: context.userName,
  };
});
function logFailure(source: string, error: { code: string; message: string }) {
  console.error("[finance]", {
    source,
    code: error.code,
    message: error.message,
  });
}
export const getFinanceOptions = cache(async () => {
  const context = await requireFinance();
  const [accounts, categories] = await Promise.all([
    context.supabase
      .from("financial_account_balances")
      .select("*")
      .eq("financial_profile_id", context.profile.id)
      .order("name"),
    context.supabase
      .from("transaction_categories")
      .select("id,financial_profile_id,name,kind,color,icon")
      .eq("financial_profile_id", context.profile.id)
      .order("name"),
  ]);
  const error = accounts.error || categories.error;
  if (error) {
    logFailure("options", error);
    return { ready: false as const, ...context, accounts: [], categories: [] };
  }
  return {
    ready: true as const,
    ...context,
    accounts: accounts.data!,
    categories: categories.data!,
  };
});
export function parseFilters(
  params: Record<string, string | undefined>,
  fixedType = "",
): Filters {
  const range = monthRange(params.month);
  const from = dateSchema.safeParse(params.from),
    to = dateSchema.safeParse(params.to);
  const start = from.success ? from.data : range.from;
  const end =
    to.success && to.data >= start
      ? to.data
      : range.to < start
        ? start
        : range.to;
  return {
    from: start,
    to: end,
    type:
      fixedType ||
      (["income", "expense", "transfer"].includes(params.type ?? "")
        ? params.type!
        : ""),
    account: params.account ?? "",
    category: params.category ?? "",
    status: ["pending", "completed", "overdue", "cancelled"].includes(
      params.status ?? "",
    )
      ? params.status!
      : "",
    kind: ["fixed", "variable"].includes(params.kind ?? "") ? params.kind! : "",
    search: (params.search ?? "").slice(0, 160),
    page: Math.max(
      1,
      Math.min(100000, Number.parseInt(params.page ?? "1") || 1),
    ),
  };
}
export async function getTransactions(filters: Filters) {
  const { supabase, profile } = await requireFinance();
  const { data, error } = await supabase.rpc("finance_transactions", {
    p_profile: profile.id,
    p_from: filters.from,
    p_to: filters.to,
    p_type: filters.type,
    p_account: filters.account,
    p_category: filters.category,
    p_status: filters.status,
    p_kind: filters.kind,
    p_search: filters.search,
    p_page: filters.page,
  });
  if (error) {
    logFailure("transactions", error);
    throw new Error("Não foi possível carregar os lançamentos.");
  }
  return data;
}
export async function getDashboard(month: string) {
  const { supabase, profile } = await requireFinance();
  const { data, error } = await supabase.rpc("finance_dashboard", {
    p_profile: profile.id,
    p_month: month + "-01",
  });
  if (error) {
    logFailure("dashboard", error);
    throw new Error("Não foi possível carregar os indicadores.");
  }
  return data;
}
