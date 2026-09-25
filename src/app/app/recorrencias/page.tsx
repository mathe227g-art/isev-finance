import Link from "next/link";
import { classifyRecurrence } from "@/app/actions/budgets";
import { ActionForm, ExpenseKind } from "@/components/finance/forms";
import { getFinanceOptions } from "@/services/finance";
import {
  PageHeading,
  PhaseTwoNotice,
  EmptyState,
  ReadOnly,
} from "@/components/finance/shared";
import {
  FinanceDialog,
  RecurrenceForm,
  RecurrenceCancel,
  GenerateForm,
} from "@/components/finance/forms";
import { frequencies, money, formatDate } from "@/lib/finance";
export default async function Recurrences() {
  const ctx = await getFinanceOptions();
  if (!ctx.ready) return <PhaseTwoNotice />;
  const { data: rows, error } = await ctx.supabase
    .from("financial_recurring_feed")
    .select("*")
    .eq("financial_profile_id", ctx.profile.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Não foi possível carregar as recorrências.");
  const write = ctx.role !== "viewer";
  return (
    <>
      <PageHeading
        title="Recorrências"
        description={`Despesas e receitas recorrentes de ${ctx.profile.name}.`}
      >
        {write && ctx.accounts.length > 0 && ctx.categories.length > 0 && (
          <FinanceDialog
            label="Nova recorrência"
            title="Criar recorrência"
            primary
          >
            <RecurrenceForm
              profileId={ctx.profile.id}
              accounts={ctx.accounts}
              categories={ctx.categories}
            />
          </FinanceDialog>
        )}
      </PageHeading>
      {!write && <ReadOnly />}
      <div className="panel recurrence-explainer">
        <h2>Previsões sob seu controle</h2>
        <p className="muted">
          Gere apenas o período que deseja acompanhar. As ocorrências nascem
          pendentes e só alteram o saldo atual quando marcadas como pagas ou
          recebidas. Cancelar uma recorrência preserva o histórico.
        </p>
        {write && rows.some((r) => r.active) && (
          <FinanceDialog
            label="Gerar previsões"
            title="Gerar lançamentos recorrentes"
            primary
          >
            <GenerateForm profileId={ctx.profile.id} />
          </FinanceDialog>
        )}
      </div>
      {!rows.length ? (
        <EmptyState
          title="Nenhuma recorrência cadastrada."
          description="Comece com aluguel, salário, assinaturas ou contratos mensais."
        >
          {!ctx.accounts.length ? (
            <Link className="button primary" href="/app/contas">
              Criar conta
            </Link>
          ) : !ctx.categories.length ? (
            <Link className="button primary" href="/app/categorias">
              Adicionar categorias
            </Link>
          ) : null}
        </EmptyState>
      ) : (
        <div className="recurrences-grid">
          {rows.map((r) => (
            <article className="panel" key={r.id}>
              <div className="section-heading">
                <span
                  className={`status-badge ${r.active ? "status-completed" : "status-cancelled"}`}
                >
                  {r.active ? "Ativa" : "Cancelada"}
                </span>
                <span className="muted">
                  {r.type === "income"
                    ? "Receita"
                    : r.expense_kind === "fixed"
                      ? "Despesa fixa"
                      : "Despesa variável"}
                </span>
              </div>
              <h2>{r.description}</h2>
              <strong className="recurrence-amount">{money(r.amount)}</strong>
              <p className="muted">
                {frequencies[r.frequency]} ·{" "}
                {r.frequency === "weekly"
                  ? "A partir da data inicial"
                  : `Dia ${r.due_day}`}
              </p>
              <p className="muted">
                {formatDate(r.start_date)} →{" "}
                {r.end_date ? formatDate(r.end_date) : "Sem data final"}
              </p>
              <p className="muted">
                {ctx.accounts.find((a) => a.id === r.account_id)?.name} ·{" "}
                {ctx.categories.find((c) => c.id === r.category_id)?.name}
              </p>
              {write && r.active && (
                <div className="row-actions">
                  <RecurrenceCancel profileId={ctx.profile.id} recurrence={r} />
                  {r.expense_kind && r.type === "expense" && (
                    <FinanceDialog
                      label="Classificação"
                      title="Classificar recorrência"
                    >
                      <ActionForm
                        action={classifyRecurrence}
                        profileId={ctx.profile.id}
                        id={r.id}
                      >
                        <ExpenseKind value={r.expense_kind} />
                        <p className="field-hint">
                          Aplica-se apenas a novas ocorrências. Edite
                          lançamentos existentes individualmente.
                        </p>
                      </ActionForm>
                    </FinanceDialog>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
