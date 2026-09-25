import Link from "next/link";
import {
  getFinanceOptions,
  getTransactions,
  parseFilters,
} from "@/services/finance";
import {
  PageHeading,
  PhaseTwoNotice,
  EmptyState,
  ReadOnly,
  Metric,
  PeriodNav,
} from "./shared";
import { FinanceDialog } from "./forms";
import { NewEntryForm } from "@/components/wealth/forms";
import { getWealth } from "@/services/wealth";
import {
  TransactionTable,
  TransactionFilters,
  Pagination,
  filterHref,
} from "./transactions";
export type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;
export async function normalizeParams(params: SearchParams) {
  return Object.fromEntries(
    Object.entries(await params).map(([k, v]) => [
      k,
      Array.isArray(v) ? v[0] : v,
    ]),
  );
}
export async function TransactionPage({
  searchParams,
  type = "",
}: {
  searchParams: SearchParams;
  type?: "" | "income" | "expense";
}) {
  const ctx = await getFinanceOptions();
  if (!ctx.ready) return <PhaseTwoNotice />;
  const params = await normalizeParams(searchParams);
  const filters = parseFilters(params, type);
  const result = await getTransactions(filters);
  const path =
    type === "income"
      ? "/app/receitas"
      : type === "expense"
        ? "/app/despesas"
        : "/app/transacoes";
  const title =
    type === "income"
      ? "Receitas"
      : type === "expense"
        ? "Despesas"
        : "Transações";
  const wealth = await getWealth();
  const write = ctx.role !== "viewer";
  const form = (
    <NewEntryForm
      cards={wealth?.cards ?? []}
      profileId={ctx.profile.id}
      accounts={ctx.accounts}
      categories={ctx.categories}
      initialType={type || "expense"}
    />
  );
  return (
    <>
      <PageHeading
        title={title}
        description={`${ctx.profile.name} · Apenas lançamentos deste perfil.`}
      >
        <Link className="button secondary" href="/app/recorrencias">
          Recorrências
        </Link>
        {write && ctx.accounts.length > 0 && (
          <FinanceDialog
            label="Novo lançamento"
            title="Adicionar lançamento"
            primary
          >
            {form}
          </FinanceDialog>
        )}
      </PageHeading>
      {!write && <ReadOnly />}
      <div className="period-row">
        <PeriodNav path={path} month={filters.from.slice(0, 7)} />
        <span className="muted">Filtros usam a data do lançamento.</span>
      </div>
      {type === "expense" && (
        <nav className="finance-tabs" aria-label="Tipos de despesa">
          {[
            { label: "Todas", kind: "" },
            { label: "Fixas", kind: "fixed" },
            { label: "Variáveis", kind: "variable" },
          ].map((item) => (
            <Link
              key={item.kind}
              className={filters.kind === item.kind ? "selected" : ""}
              href={filterHref(path, filters, { kind: item.kind, page: 1 })}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
      {!ctx.accounts.length ? (
        <EmptyState
          title="Crie uma conta para começar."
          description="Cada receita, despesa ou transferência precisa de uma conta deste perfil."
        >
          <Link className="button primary" href="/app/contas">
            Criar primeira conta
          </Link>
        </EmptyState>
      ) : (
        <>
          <TransactionFilters
            filters={filters}
            accounts={ctx.accounts}
            categories={ctx.categories}
            path={path}
            fixedType={type}
          />
          {type && (
            <div className="metric-grid finance-metrics">
              <Metric
                title={type === "income" ? "Recebidas" : "Realizadas"}
                value={result.summary.completed}
                hint="No período e filtros selecionados"
              />
              <Metric
                title="Pendentes"
                value={result.summary.pending}
                hint="Inclui valores atrasados"
              />
              <Metric
                title={type === "income" ? "Previstas" : "Atrasadas"}
                value={
                  type === "income"
                    ? result.summary.expected
                    : result.summary.overdue
                }
                hint={
                  type === "income"
                    ? "Recebidas + pendentes"
                    : "Pendentes com vencimento passado"
                }
              />
              <Metric
                title="Total do período"
                value={result.summary.expected}
                hint="Sem lançamentos cancelados"
              />
            </div>
          )}
          {result.rows.length ? (
            <section className="panel transaction-panel">
              <div className="section-heading">
                <h2>{title} do período</h2>
                <span className="muted">{result.total} registros</span>
              </div>
              <TransactionTable
                rows={result.rows}
                profileId={ctx.profile.id}
                accounts={ctx.accounts}
                categories={ctx.categories}
                role={ctx.role}
              />
              <Pagination filters={filters} total={result.total} path={path} />
            </section>
          ) : (
            <EmptyState
              title="Nenhuma transação encontrada neste período."
              description="Altere os filtros ou adicione seu primeiro lançamento."
            >
              {write && (
                <FinanceDialog
                  label="Adicionar transação"
                  title="Novo lançamento"
                  primary
                >
                  {form}
                </FinanceDialog>
              )}
              {filters.page > 1 && (
                <Link
                  className="text-link"
                  href={filterHref(path, filters, { page: 1 })}
                >
                  Voltar à primeira página
                </Link>
              )}
            </EmptyState>
          )}
        </>
      )}
      <p className="finance-footnote">
        {ctx.accounts.some((a) => a.phase_three_ready)
          ? "Fixas e variáveis seguem a classificação escolhida no lançamento. Recorrências também podem ser variáveis."
          : "A classificação explícita fica disponível após ativar a Fase 3. Até lá, a Fase 2 identifica ocorrências recorrentes como fixas."}{" "}
        “Atrasada” é calculado pelo vencimento e pela situação pendente.
      </p>
    </>
  );
}
