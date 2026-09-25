import Link from "next/link";
import { CircleCheck, TriangleAlert, Info } from "lucide-react";
import { Metric } from "./shared";
import { money, formatDate } from "@/lib/finance";
import { percent, budgetStates, financialAlerts } from "@/lib/insights";
import type { Budget, Insights, BudgetCategory } from "@/types/insights";
import type { TransactionRow } from "@/types/finance";
export function PhaseThreeNotice() {
  return (
    <section className="panel empty-chart">
      <h2>O orçamento aguarda ativação.</h2>
      <p>
        Aplique a migration da Fase 3 após revisá-la. Suas contas e lançamentos
        continuam disponíveis.
      </p>
      <Link className="button secondary" href="/app">
        Voltar à visão geral
      </Link>
    </section>
  );
}
export function BudgetProgress({
  percentage,
  state,
}: {
  percentage: string | null;
  state?: BudgetCategory["state"];
}) {
  const number = percentage === null ? 0 : Number(percentage);
  return (
    <div className={`budget-progress ${state ?? ""}`}>
      <progress
        max={100}
        value={Math.min(100, Math.max(0, number))}
        aria-label="Percentual do orçamento utilizado"
        aria-valuetext={percent(percentage)}
      />
      <span>
        {state &&
          (state === "normal" ? (
            <CircleCheck size={15} />
          ) : (
            <TriangleAlert size={15} />
          ))}
        {state ? budgetStates[state] : percent(percentage)}
        {state && percentage !== null ? " · " + percent(percentage) : ""}
      </span>
    </div>
  );
}
export function BudgetMetrics({ budget }: { budget: Budget }) {
  return (
    <div className="metric-grid analysis-metrics">
      <Metric title="Orçamento planejado" value={budget.planned} />
      <Metric
        title="Valor realizado"
        value={budget.actual}
        hint="Todas as despesas realizadas do mês"
      />
      <Metric
        title="Valor disponível"
        value={budget.remaining}
        hint="Planejado − realizado"
      />
      <article className="metric-card">
        <div>Percentual utilizado</div>
        <strong className="money-value">{percent(budget.percentage)}</strong>
        <p>
          {budget.configured
            ? "Inclui gastos de categorias sem orçamento"
            : "Defina seu orçamento para calcular"}
        </p>
      </article>
    </div>
  );
}
export function BudgetSummary({
  budget,
  month,
}: {
  budget: Budget;
  month: string;
}) {
  return (
    <section className="panel analysis-panel">
      <div className="section-heading">
        <h2>Orçamento do mês</h2>
        <Link className="text-link" href={`/app/orcamento?month=${month}`}>
          {budget.configured ? "Ver orçamento" : "Criar orçamento"}
        </Link>
      </div>
      {budget.configured ? (
        <>
          <dl className="analysis-totals">
            <div>
              <dt>Planejado</dt>
              <dd>{money(budget.planned)}</dd>
            </div>
            <div>
              <dt>Utilizado</dt>
              <dd>{money(budget.actual)}</dd>
            </div>
            <div>
              <dt>Disponível</dt>
              <dd>{money(budget.remaining)}</dd>
            </div>
          </dl>
          <BudgetProgress percentage={budget.percentage} />
        </>
      ) : (
        <p className="muted">Você ainda não definiu seu orçamento deste mês.</p>
      )}
    </section>
  );
}
export function FinancialAlerts({ data }: { data: Insights }) {
  const alerts = financialAlerts(data);
  return (
    <section className="panel analysis-panel">
      <h2>Alertas financeiros</h2>
      <p className="field-hint">
        Orçamento e resultado do mês selecionado; vencimentos em relação a hoje.
      </p>
      {alerts.length ? (
        <ul className="financial-alerts">
          {alerts.map((a, i) => (
            <li
              key={i}
              className={
                a.level === "crítico"
                  ? "critical"
                  : a.level === "atenção"
                    ? "attention"
                    : "information"
              }
            >
              {a.level === "informação" ? (
                <Info size={19} />
              ) : (
                <TriangleAlert size={19} />
              )}
              <div>
                <strong>{a.level}</strong>
                <p>{a.text}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          Nenhum alerta com base nos lançamentos existentes.
        </p>
      )}
    </section>
  );
}
export function Upcoming({
  rows,
  type,
  today,
}: {
  rows: TransactionRow[];
  type: "income" | "expense";
  today: string;
}) {
  return (
    <section className="panel analysis-panel">
      <div className="section-heading">
        <h2>
          {type === "expense"
            ? "Próximas despesas em conta"
            : "Próximos recebimentos"}
        </h2>
        <Link
          className="text-link"
          href={`/app/pendencias?type=${type}&from=${today}&to=2100-12-31`}
        >
          Ver todas
        </Link>
      </div>
      <p className="field-hint">
        A partir de hoje · até 5 lançamentos por vencimento
      </p>
      {rows.length ? (
        <ul className="upcoming-list">
          {rows.map((t) => (
            <li key={t.id}>
              <div>
                <strong>{t.description}</strong>
                <small>
                  {t.category_name} ·{" "}
                  {formatDate(t.due_date ?? t.transaction_date)}
                </small>
              </div>
              <strong>{money(t.amount)}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          {type === "expense"
            ? "Nenhuma conta pendente neste período."
            : "Nenhum recebimento pendente neste período."}
        </p>
      )}
    </section>
  );
}
export function Projection({ data }: { data: Insights }) {
  return (
    <section className="panel analysis-panel">
      <h2>Previsão do mês</h2>
      <dl className="analysis-totals">
        <div>
          <dt>Saldo atual</dt>
          <dd>{money(data.current_balance)}</dd>
        </div>
        <div>
          <dt>+ Receitas pendentes do mês</dt>
          <dd>{money(data.receivable)}</dd>
        </div>
        <div>
          <dt>− Pagamentos pendentes do mês</dt>
          <dd>{money(data.payable)}</dd>
        </div>
        <div className="projection-total">
          <dt>Saldo previsto</dt>
          <dd>{money(data.month_forecast)}</dd>
        </div>
      </dl>
      <p className="field-hint">
        Saldo disponível agora + receitas pendentes − despesas pendentes e
        faturas com vencimento no mês selecionado. Inclui atrasados desse mês.
        Não é saldo histórico nem estimativa estatística; considera apenas
        lançamentos já registrados, inclusive recorrências já geradas.
      </p>
    </section>
  );
}
