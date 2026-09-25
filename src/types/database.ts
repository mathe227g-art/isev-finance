import type { Insights, BudgetInsert } from "./insights";
import type {WealthOverview,CardDetail,PositionHistory} from './wealth';
import type { CustomerDashboard, ImportResult, SubscriptionRecord, WidgetId } from "./customer";
import type { Activity, BusinessContact, Receivable, TeamMember } from "./business";
import type {
  Account,
  Transaction,
  TransactionInput,
  TransactionRow,
  Recurrence,
  RecurrenceInput,
  TransactionResult,
  DashboardData,
} from "./finance";
export type FinancialProfile = {
  id: string;
  owner_id: string;
  name: string;
  kind: "CPF" | "CNPJ" | "OTHER";
  created_at: string;
  updated_at: string;
};
export type UserProfile = {
  id: string;
  full_name: string;
  created_at: string;
  updated_at: string;
};
type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};
export type Database = {
  public: {
    Tables: {
      monthly_budgets: Table<
        BudgetInsert & { id: string; created_at: string; updated_at: string },
        BudgetInsert,
        { amount: string }
      >;
      transactions: Table<
        Transaction,
        TransactionInput,
        Partial<Omit<TransactionInput, "financial_profile_id">>
      >;
      recurring_transactions: Table<
        SubscriptionRecord,
        RecurrenceInput & { is_subscription?: boolean; merchant_name?: string; service_url?: string; renewal_notice_days?: number },
        { active?: boolean; expense_kind?: "fixed" | "variable" }
      >;
      dashboard_preferences: Table<
        { financial_profile_id: string; user_id: string; widget_order: WidgetId[]; created_at: string; updated_at: string },
        { financial_profile_id: string; user_id: string; widget_order: WidgetId[] },
        { widget_order: WidgetId[] }
      >;
      import_batches: Table<
        { id: string; financial_profile_id: string; user_id: string; file_name: string; source_format: "csv"|"ofx"; row_count: number; imported_count: number; duplicate_count: number; created_at: string },
        never,
        never
      >;
      business_contacts: Table<BusinessContact,Omit<BusinessContact,"id"|"active"|"created_at"|"updated_at">,Partial<Pick<BusinessContact,"kind"|"name"|"document"|"email"|"phone"|"notes"|"active">>>;
      financial_activity_log: Table<Activity,never,never>;
      profiles: Table<
        UserProfile,
        { id: string; full_name: string },
        { full_name?: string }
      >;
      financial_profiles: Table<
        FinancialProfile,
        { owner_id: string; name: string; kind: FinancialProfile["kind"] },
        { name?: string; kind?: FinancialProfile["kind"] }
      >;
      financial_profile_members: Table<
        {
          financial_profile_id: string;
          user_id: string;
          role: "owner" | "editor" | "viewer";
          created_at: string;
        },
        never,
        never
      >;
      accounts: Table<
        {
          id: string;
          financial_profile_id: string;
          name: string;
          institution: string | null;
          kind: string;
          opening_balance: number;
          currency: string;
          created_at: string;
          updated_at: string;
        },
        {
          financial_profile_id: string;
          name: string;
          institution?: string;
          kind?: string;
          opening_balance?: string;
        },
        {
          name?: string;
          institution?: string | null;
          opening_balance?: string;
          kind?: string;
        }
      >;
      transaction_categories: Table<
        {
          id: string;
          financial_profile_id: string;
          name: string;
          kind: "income" | "expense";
          color: string;
          icon: string;
          created_at: string;
          updated_at: string;
        },
        {
          financial_profile_id: string;
          name: string;
          kind: "income" | "expense";
          color?: string;
          icon?: string;
        },
        {
          name?: string;
          color?: string;
          icon?: string;
          kind?: "income" | "expense";
        }
      >;
    };
    Views: {
      financial_account_balances: { Row: Account; Relationships: [] };
      financial_transaction_feed: { Row: TransactionRow; Relationships: [] };
      financial_recurring_feed: { Row: Recurrence; Relationships: [] };
    };
    Functions: {
      wealth_overview:{Args:{p_profile:string};Returns:WealthOverview};
      wealth_card_detail:{Args:{p_profile:string;p_card:string;p_month:string};Returns:CardDetail|null};
      wealth_history:{Args:{p_profile:string;p_position:string;p_page:number};Returns:PositionHistory};
      wealth_save:{Args:{p_profile:string;p_entity:string;p_id:string|null;p_data:Record<string,string|number|boolean|null>};Returns:string};
      wealth_purchase:{Args:{p_profile:string;p_card:string;p_category:string;p_description:string;p_amount:string;p_date:string;p_count:number;p_kind:string;p_notes:string;p_request:string};Returns:string};
      wealth_cancel_purchase:{Args:{p_profile:string;p_purchase:string};Returns:undefined};
      wealth_pay_invoice:{Args:{p_profile:string;p_invoice:string;p_account:string;p_date:string};Returns:undefined};
      wealth_move:{Args:{p_profile:string;p_position:string;p_kind:string;p_amount:string;p_account:string|null;p_date:string;p_notes:string;p_request:string};Returns:string};
      wealth_snapshot:{Args:{p_profile:string};Returns:undefined};
      finance_insights: {
        Args: { p_profile: string; p_month: string; p_window?: string };
        Returns: Insights;
      };
      finance_due: {
        Args: {
          p_profile: string;
          p_type: string;
          p_from: string;
          p_to: string;
          p_page?: number;
        };
        Returns: { rows: TransactionRow[]; total: number };
      };
      materialize_recurring: {
        Args: { p_profile: string; p_from: string; p_to: string };
        Returns: number;
      };
      finance_transactions: {
        Args: {
          p_profile: string;
          p_from: string;
          p_to: string;
          p_type?: string;
          p_account?: string;
          p_category?: string;
          p_status?: string;
          p_search?: string;
          p_kind?: string;
          p_page?: number;
        };
        Returns: TransactionResult;
      };
      finance_dashboard: {
        Args: { p_profile: string; p_month: string };
        Returns: DashboardData;
      };
      customer_dashboard: {
        Args: { p_profile: string; p_month: string };
        Returns: CustomerDashboard;
      };
      finance_import_transactions: {
        Args: { p_profile: string; p_account: string; p_income_category: string; p_expense_category: string; p_file_name: string; p_format: string; p_rows: { date: string; description: string; amount: string; type: string }[] };
        Returns: ImportResult;
      };
      business_receivables: { Args: { p_profile: string }; Returns: Receivable[] };
      profile_team: { Args: { p_profile: string }; Returns: TeamMember[] };
      profile_add_member_by_email: { Args: { p_profile: string; p_email: string; p_role: string }; Returns: string };
      profile_remove_member: { Args: { p_profile: string; p_user: string }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
