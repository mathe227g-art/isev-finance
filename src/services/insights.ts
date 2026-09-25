import "server-only";
import { cache } from "react";
import { requireFinance } from "./finance";
import { validWindow } from "@/lib/insights";
export const getInsights = cache(async (month: string, window?: string) => {
  const { supabase, profile } = await requireFinance();
  const { data, error } = await supabase.rpc("finance_insights", {
    p_profile: profile.id,
    p_month: month + "-01",
    p_window: validWindow(window),
  });
    if (error) {
      if (error.code === "PGRST202" || error.code === "42883") return null;
      console.error("[finance-insights]", {
      code: error.code,
      message: error.message,
    });
    throw new Error(
      "Não foi possível carregar a análise financeira. Tente novamente.",
    );
  }
  return data;
});
