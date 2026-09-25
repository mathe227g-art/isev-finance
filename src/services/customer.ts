import "server-only";
import { cache } from "react";
import { requireFinance } from "./finance";
import type { CustomerDashboard, SubscriptionRecord, WidgetId } from "@/types/customer";
import { widgetIds } from "@/types/customer";

const missing = (code?: string) => code === "PGRST202" || code === "PGRST205" || code === "42P01" || code === "42883" || code === "42703";
export const getCustomerDashboard = cache(async (month: string) => {
  const ctx = await requireFinance();
  const [dashboard, preference] = await Promise.all([
    ctx.supabase.rpc("customer_dashboard", { p_profile: ctx.profile.id, p_month: month + "-01" }),
    ctx.supabase.from("dashboard_preferences").select("widget_order").eq("financial_profile_id", ctx.profile.id).single(),
  ]);
  if (dashboard.error) {
    if (missing(dashboard.error.code)) return null;
    console.error("[customer-dashboard]", { code: dashboard.error.code, message: dashboard.error.message });
    throw new Error("Não foi possível carregar a central financeira.");
  }
  const saved = preference.data?.widget_order?.filter((item): item is WidgetId => widgetIds.includes(item as WidgetId));
  return { data: dashboard.data as CustomerDashboard, widgets: saved?.length ? saved : [...widgetIds] };
});
export const getSubscriptions = cache(async () => {
  const ctx = await requireFinance();
  const result = await ctx.supabase.from("recurring_transactions").select("*").eq("financial_profile_id", ctx.profile.id).eq("is_subscription", true).order("active", { ascending: false }).order("due_day");
  if (result.error) {
    if (missing(result.error.code)) return null;
    throw result.error;
  }
  return result.data as SubscriptionRecord[];
});
export const getImportHistory = cache(async () => {
  const ctx = await requireFinance();
  const result = await ctx.supabase.from("import_batches").select("id,file_name,source_format,row_count,imported_count,duplicate_count,created_at").eq("financial_profile_id",ctx.profile.id).order("created_at",{ascending:false}).limit(10);
  if (result.error) {
    if (missing(result.error.code)) return null;
    throw result.error;
  }
  return result.data;
});
