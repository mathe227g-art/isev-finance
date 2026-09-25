export type Role = "owner" | "editor" | "viewer";
export type TransactionType = "income" | "expense" | "transfer";
export type TransactionStatus = "pending" | "completed" | "cancelled";
export type AccountKind =
  | "checking"
  | "savings"
  | "digital"
  | "wallet"
  | "cash"
  | "investment"
  | "other";
export type Account = {
  phase_four_ready?: boolean;
  phase_three_ready?: boolean;
  id: string;
  financial_profile_id: string;
  name: string;
  institution: string | null;
  kind: AccountKind;
  currency: string;
  opening_balance: string;
  current_balance: string;
  projected_balance: string;
};
export type Category = {
  id: string;
  financial_profile_id: string;
  name: string;
  kind: "income" | "expense";
  color: string;
  icon: string;
};
export type TransactionInput = {
  contact_id?: string | null;
  expense_kind?: "fixed" | "variable";
  financial_profile_id: string;
  account_id: string;
  destination_account_id: string | null;
  category_id: string | null;
  type: TransactionType;
  description: string;
  amount: string;
  transaction_date: string;
  due_date: string | null;
  status: TransactionStatus;
  notes: string;
};
export type Transaction = TransactionInput & {
  id: string;
  created_at: string;
  recurring_transaction_id: string | null;
  occurrence_date: string | null;
};
export type TransactionRow = Omit<Transaction,'account_id'> & {
  account_id:string|null;
  source?:'account'|'card';
  card_id?:string|null;
  account_name: string;
  destination_name: string | null;
  category_name: string | null;
  category_color: string | null;
  category_icon: string | null;
  display_status: TransactionStatus | "overdue";
  expense_kind: "fixed" | "variable";
};
export type RecurrenceInput = {
  expense_kind?: "fixed" | "variable";
  financial_profile_id: string;
  account_id: string;
  category_id: string;
  type: "income" | "expense";
  description: string;
  amount: string;
  frequency:
    "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";
  due_day: number;
  start_date: string;
  end_date: string | null;
  notes: string;
};
export type Recurrence = RecurrenceInput & {
  id: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};
export type TransactionResult = {
  rows: TransactionRow[];
  total: number;
  summary: {
    completed: string;
    pending: string;
    overdue: string;
    expected: string;
  };
};
export type DashboardData = {
  current_balance: string;
  projected_balance: string;
  income: string;
  expense: string;
  result: string;
  payable: string;
  receivable: string;
  history: { month: string; income: string; expense: string }[];
  categories: {
    id: string;
    name: string;
    color: string;
    amount: string;
    percentage: string;
  }[];
  recent: TransactionRow[];
  upcoming: TransactionRow[];
};
export type Filters = {
  from: string;
  to: string;
  type: string;
  account: string;
  category: string;
  status: string;
  search: string;
  kind: string;
  page: number;
};
