import "server-only";
import { cache } from "react";
import { requireFinance } from "./finance";
export const getWealth = cache(async () => {
  const ctx = await requireFinance();
  const { data, error } = await ctx.supabase.rpc("wealth_overview", {
    p_profile: ctx.profile.id,
  });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") return null;
    console.error("[wealth-read]", {
      code: error.code,
      message: error.message,
    });
    throw new Error("Não foi possível carregar seus cartões e patrimônio.");
  }
  return data;
});
export async function getCardDetail(id: string, month: string) {
  const ctx = await requireFinance();
  const { data, error } = await ctx.supabase.rpc("wealth_card_detail", {
    p_profile: ctx.profile.id,
    p_card: id,
    p_month: month + "-01",
  });
  if (error) throw new Error("Não foi possível carregar a fatura.");
  return data;
}
export async function getPositionHistory(id: string, page: number) {
  const ctx = await requireFinance();
  const { data, error } = await ctx.supabase.rpc("wealth_history", {
    p_profile: ctx.profile.id,
    p_position: id,
    p_page: page,
  });
  if (error) throw new Error("Não foi possível carregar o histórico.");
  return data;
}
