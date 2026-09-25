import Link from "next/link";
import { getFinanceOptions } from "@/services/finance";
import { getInsights } from "@/services/insights";
import { monthRange, money } from "@/lib/finance";
import { percent } from "@/lib/insights";
import {
  normalizeParams,
  type SearchParams,
} from "@/components/finance/transaction-page";
import {
  PageHeading,
  PeriodNav,
  ReadOnly,
  EmptyState,
  PhaseTwoNotice,
} from "@/components/finance/shared";
import { FinanceDialog, ConfirmAction } from "@/components/finance/forms";
import { BudgetForm } from "@/components/finance/budget-form";
import {
  BudgetMetrics,
  BudgetProgress,
  PhaseThreeNotice,
} from "@/components/finance/insights";
import { BudgetChart, KindsChart } from "@/components/finance/insight-charts";
import { deleteBudget } from "@/app/actions/budgets";
export default async function BudgetPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await normalizeParams(searchParams);
  const { month } = monthRange(params.month);
  const ctx = await getFinanceOptions();
  if (!ctx.ready) return <PhaseTwoNotice />;
  const data = await getInsights(month);
  if (!data) return <PhaseThreeNotice />;
  const write = ctx.role !== "viewer";
  const available = ctx.categories.filter(
    (c) =>
      c.kind === "expense" &&
      !data.budget.categories.some((b) => b.id && b.category_id === c.id),
  );
  return (
    <>
      <PageHeading
        title="Orçamento"
        description={`${ctx.profile.name} · Planeje seus limites e acompanhe suas escolhas.`}
      >
        {write && available.length > 0 && (
          <FinanceDialog
            primary
            label="Adicionar orçamento"
            title="Novo orçamento mensal"
          >
            <BudgetForm
              profileId={ctx.profile.id}
              month={month}
              categories={available}
            />
          </FinanceDialog>
        )}
      </PageHeading>
      {!write && <ReadOnly />}
      <div className="period-row">
        <PeriodNav month={month} path="/app/orcamento" />
        <form method="get" className="month-picker">
          <label>
            Mês e ano
            <input
              type="month"
              name="month"
              defaultValue={month}
              min="1900-01"
              max="2100-12"
              required
            />
          </label>
          <button className="button secondary">Abrir</button>
        </form>
      </div>
      {!data.budget.configured && (
        <EmptyState
          title="Você ainda não criou um orçamento para este mês."
          description="Defina limites por categoria. Seus gastos já registrados continuam visíveis abaixo."
        >
          {!ctx.categories.some((c) => c.kind === "expense") && (
            <Link className="button primary" href="/app/categorias">
              Criar categoria de despesa
            </Link>
          )}
        </EmptyState>
      )}
      <BudgetMetrics budget={data.budget} />
      <p className="finance-footnote">
        Realizado inclui todas as despesas realizadas pela data do lançamento, mesmo
        sem orçamento. Pendentes, canceladas e transferências não consomem o
        orçamento.
      </p>
      <div className="budget-categories">
        {data.budget.categories.map((c) => (
          <article className="panel budget-category" key={c.category_id}>
            <div className="section-heading">
              <h2>{c.name}</h2>
              <span className="category-dot" style={{ background: c.color }} />
            </div>
            <dl className="analysis-totals">
              <div>
                <dt>Planejado</dt>
                <dd>{c.id ? money(c.planned) : "Não definido"}</dd>
              </div>
              <div>
                <dt>Realizado</dt>
                <dd>{money(c.actual)}</dd>
              </div>
              <div>
                <dt>Restante</dt>
                <dd>{c.id ? money(c.remaining) : "—"}</dd>
              </div>
            </dl>
            <BudgetProgress percentage={c.percentage} state={c.state} />
            {write && (
              <div className="row-actions">
                <FinanceDialog
                  label={c.id ? "Editar" : "Definir orçamento"}
                  title={c.id ? "Editar orçamento" : "Definir orçamento"}
                >
                  <BudgetForm
                    profileId={ctx.profile.id}
                    month={month}
                    categories={available}
                    budget={c}
                    categoryId={c.category_id}
                  />
                </FinanceDialog>
                {c.id && ctx.role === "owner" && (
                  <ConfirmAction
                    label="Excluir"
                    profileId={ctx.profile.id}
                    id={c.id}
                    action={deleteBudget}
                    message={`Excluir o limite de ${c.name} deste mês? Seus lançamentos serão preservados.`}
                  />
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="finance-chart-grid">
        <section className="panel analysis-panel">
          <h2>Planejado x realizado</h2>
          <BudgetChart budget={data.budget} />
        </section>
        <section className="panel analysis-panel">
          <h2>Gastos fixos x variáveis</h2>
          <KindsChart kinds={data.kinds} />
          <ul className="category-legend">
            {data.kinds.map((k) => (
              <li key={k.kind}>
                <span>
                  {k.kind === "fixed" ? "Fixas" : "Variáveis"} · {k.count}{" "}
                  lançamentos
                </span>
                <strong>
                  {money(k.amount)} · {percent(k.percentage)}
                </strong>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
