import type { DashboardData, TransactionRow } from "./finance";
export type BudgetCategory = {
  id: string | null;
  category_id: string;
  name: string;
  color: string;
  planned: string;
  actual: string;
  remaining: string;
  percentage: string | null;
  state: "normal" | "near" | "reached" | "exceeded" | "unplanned";
};
export type Budget = {
  planned: string;
  actual: string;
  remaining: string;
  percentage: string | null;
  configured: number;
  categories: BudgetCategory[];
};
export type SeriesPoint = { date: string; income: string; expense: string };
export type Insights = DashboardData & {
  budget: Budget;
  kinds: {
    kind: "fixed" | "variable";
    amount: string;
    percentage: string;
    count: number;
  }[];
  daily: SeriesPoint[];
  movement: SeriesPoint[];
  chart_from: string;
  chart_to: string;
  monthly: boolean;
  next_pay: TransactionRow[];
  next_receive: TransactionRow[];
  due_week: string;
  overdue: string;
  month_forecast: string;
  today: string;
};
export type BudgetInsert = {
  financial_profile_id: string;
  category_id: string;
  month: string;
  amount: string;
};
