import type { Recurrence } from "./finance";

export const widgetIds = ["actions", "safe_spend", "cashflow", "comparison", "subscriptions"] as const;
export type WidgetId = (typeof widgetIds)[number];
export type CustomerDashboard = {
  safe_to_spend: string;
  safe_components: { balance: string; income_30d: string; expense_30d: string; budget_reserve: string };
  cashflow: { days: number; projected: string }[];
  comparison: {
    current: { income: string; expense: string };
    previous: { income: string; expense: string };
  };
  actions: { kind: string; title: string; count: number; amount: string; href: string }[];
  subscriptions: Subscription[];
};
export type Subscription = Pick<Recurrence, "id" | "description" | "amount" | "frequency" | "due_day"> & {
  merchant_name: string;
  service_url: string;
  renewal_notice_days: number;
};
export type SubscriptionRecord = Recurrence & Subscription & { is_subscription: boolean };
export type ImportRow = { date: string; description: string; amount: string; type: "income" | "expense" };
export type ImportResult = { batch_id: string; rows: number; imported: number; duplicates: number };
