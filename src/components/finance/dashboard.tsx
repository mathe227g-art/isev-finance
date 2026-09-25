import Link from "next/link";
import { getFinanceOptions, getDashboard } from "@/services/finance";
import { PageHeading, PeriodNav, Metric, EmptyState, ReadOnly } from "./shared";
import { FinanceDialog } from "./forms";
import { NewEntryForm } from "@/components/wealth/forms";
import { getWealth } from "@/services/wealth";
import { WealthSummary } from "@/components/wealth/shared";
import { FinanceCharts } from "./charts";
import { TransactionTable } from "./transactions";
import { monthRange } from "@/lib/finance";
import { Dashboard as InitialDashboard } from "@/components/dashboard";
import { getProfileContext } from "@/services/financial-profiles";
import { getInsights } from "@/services/insights";
import { windows, validWindow } from "@/lib/insights";
import { formatDate } from "@/lib/finance";
import {
  BudgetSummary,
  FinancialAlerts,
  Upcoming,
  Projection,
} from "./insights";
import { MovementChart } from "./insight-charts";
import { getCustomerDashboard } from "@/services/customer";
import { CustomerValueDashboard } from "@/components/customer/dashboard";
export async function FinancialDashboard({
  month,
  created,
  window,
}: {
  month?: string;
  created: boolean;
  window?: string;
}) {
  const ctx = await getFinanceOptions();
  const range = monthRange(month);
  if (!ctx.ready) {
    const { profiles } = await getProfileContext();
    return (
      <>
        <p className="feedback neutral">
          A Fase 2 aguarda ativação da migration ou restabelecimento da conexão.
          Seus perfis e acesso continuam disponíveis.
        </p>
        <InitialDashboard
          active={ctx.profile}
          userName={ctx.userName}
          profileCount={profiles.length}
          created={created}
        />
      </>
    );
  }
  const insights = await getInsights(range.month, window);
  const data = insights ?? (await getDashboard(range.month));
  const wealth = await getWealth();
  const customer = await getCustomerDashboard(range.month);
  const write = ctx.role !== "viewer";
  return (
    <>
      <PageHeading
        title={`Olá, ${ctx.userName.split(" ")[0]}.`}
        description={`Seu resumo financeiro de ${ctx.profile.name}.`}
      >
        {write && ctx.accounts.length > 0 && (
          <FinanceDialog
            primary
            label="Novo lançamento"
            title="Adicionar lançamento"
          >
            <NewEntryForm
              cards={wealth?.cards ?? []}
              profileId={ctx.profile.id}
              accounts={ctx.accounts}
              categories={ctx.categories}
            />
          </FinanceDialog>
        )}
      </PageHeading>
      {created && (
        <p className="feedback success" role="status">
          Perfil criado. Comece adicionando sua primeira conta.
        </p>
      )}
      {!write && <ReadOnly />}
      <div className="period-row">
        <PeriodNav month={range.month} />
        <form method="get" className="month-picker">
          <label>
            Mês e ano
            <input
              type="month"
              name="month"
              defaultValue={range.month}
              min="1900-01"
              max="2100-12"
              required
            />
          </label>
          <input type="hidden" name="window" value={validWindow(window)} />
          <button className="button secondary">Abrir</button>
        </form>
        <Link href="/app/recorrencias" className="text-link">
          Gerenciar previsões e recorrências
        </Link>
      </div>
      {!ctx.accounts.length ? (
        <EmptyState
          title="Tudo pronto para seu primeiro lançamento."
          description="Cadastre uma conta com o saldo inicial e adicione categorias para começar."
        >
          <Link className="button primary" href="/app/contas">
            Criar primeira conta
          </Link>
        </EmptyState>
      ) : (
        <>
          {!insights && (
            <p className="feedback neutral">
              Orçamento e análises adicionais aguardam a migration da Fase 3.
            </p>
          )}
          <div className="metric-grid analysis-metrics">
            <Metric
              title="Saldo atual"
              value={data.current_balance}
              hint="Disponível agora · todas as contas"
            />
            <Metric
              title="Receitas do mês"
              value={data.income}
              hint="Recebidas no período"
            />
            <Metric
              title="Despesas do mês"
              value={data.expense}
              hint="Pagas em conta + compras no cartão"
            />
            <Metric
              title="Resultado do mês"
              value={data.result}
              hint="Receitas − despesas; sem transferências"
            />
          </div>
          <div className="metric-grid analysis-metrics">
            <Metric
              title="Contas a pagar"
              value={data.payable}
              hint="Pendências e faturas com vencimento no mês"
            />
            <Metric
              title="Contas a receber"
              value={data.receivable}
              hint="Pendentes com vencimento no mês"
            />
            {insights?.kinds.map((k) => (
              <Metric
                key={k.kind}
                title={
                  k.kind === "fixed" ? "Despesas fixas" : "Despesas variáveis"
                }
                value={k.amount}
                hint={`${k.count} lançamentos realizados · ${k.percentage.replace(".", ",")}% das despesas`}
              />
            ))}
          </div>
          {wealth && <WealthSummary data={wealth} />}
          {customer && <CustomerValueDashboard data={customer.data} widgets={customer.widgets} month={range.month} />}
          <div className="projection-note">
            Projeções consideram somente lançamentos já registrados.{" "}
            <Link href="/app/contas">Ver saldo previsto por conta</Link>
          </div>
          {insights ? (
            <>
              <section className="panel analysis-panel">
                <div className="section-heading">
                  <h2>Movimentação financeira</h2>
                  <span className="muted">
                    {formatDate(insights.chart_from)} —{" "}
                    {formatDate(insights.chart_to)}
                  </span>
                </div>
                <nav
                  className="finance-tabs chart-tabs"
                  aria-label="Período do gráfico"
                >
                  {Object.entries(windows).map(([key, label]) => (
                    <Link
                      key={key}
                      className={validWindow(window) === key ? "selected" : ""}
                      href={`/app?month=${range.month}&window=${key}`}
                    >
                      {label}
                    </Link>
                  ))}
                </nav>
                <p className="field-hint">
                  Períodos relativos ao mês selecionado. Nos últimos 7 dias, o
                  intervalo termina hoje no mês atual ou no último dia do mês
                  escolhido.
                </p>
                <MovementChart
                  points={insights.movement}
                  monthly={insights.monthly}
                />
              </section>
              <div className="finance-chart-grid">
                <BudgetSummary budget={insights.budget} month={range.month} />
                <Projection data={insights} />
              </div>
              <div className="finance-chart-grid">
                <section className="panel analysis-panel">
                  <h2>Evolução do mês</h2>
                  <p className="field-hint">
                    Receitas recebidas e despesas realizadas, acumuladas por
                    dia.
                  </p>
                  <MovementChart points={insights.daily} cumulative />
                </section>
                <FinanceCharts data={data} onlyCategories />
              </div>
              <div className="finance-chart-grid">
                <Upcoming
                  rows={insights.next_pay}
                  type="expense"
                  today={insights.today}
                />
                <Upcoming
                  rows={insights.next_receive}
                  type="income"
                  today={insights.today}
                />
              </div>
              <FinancialAlerts data={insights} />
            </>
          ) : (
            <FinanceCharts data={data} />
          )}
          <section className="panel transaction-panel">
            <div className="section-heading">
              <h2>Agenda de vencimentos em conta</h2>
              <span className="muted">Pendências do mês selecionado</span>
            </div>
            {data.upcoming.length ? (
              <TransactionTable
                rows={data.upcoming}
                profileId={ctx.profile.id}
                accounts={ctx.accounts}
                categories={ctx.categories}
                role={ctx.role}
                editable={false}
              />
            ) : (
              <div className="empty-chart">
                <h3>Nenhum vencimento pendente neste mês</h3>
                <p>
                  Navegue entre os meses para acompanhar seus lançamentos
                  futuros.
                </p>
              </div>
            )}
          </section>
          <section className="panel transaction-panel">
            <div className="section-heading">
              <h2>Últimas movimentações</h2>
              <Link
                className="text-link"
                href={`/app/transacoes?month=${range.month}`}
              >
                Ver todas
              </Link>
            </div>
            {data.recent.length ? (
              <TransactionTable
                rows={data.recent}
                profileId={ctx.profile.id}
                accounts={ctx.accounts}
                categories={ctx.categories}
                role={ctx.role}
                editable={false}
              />
            ) : (
              <div className="empty-chart">
                <h3>Nenhuma movimentação neste período</h3>
                <p>Adicione um lançamento ou navegue para outro mês.</p>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
