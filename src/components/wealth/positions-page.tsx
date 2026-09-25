import Link from "next/link";
import { getFinanceOptions } from "@/services/finance";
import { getWealth } from "@/services/wealth";
import {
  PageHeading,
  Metric,
  EmptyState,
  ReadOnly,
} from "@/components/finance/shared";
import { FinanceDialog } from "@/components/finance/forms";
import { PositionForm, PositionStatus, MovementForm } from "./forms";
import { WealthNotice, WealthProgress } from "./shared";
import { AllocationChart, WealthEvolution } from "./charts";
import { money, formatDate } from "@/lib/finance";
import { percent } from "@/lib/insights";
import { investmentTypes, positionLabels } from "@/lib/wealth";
import type { PositionKind } from "@/types/wealth";
export async function PositionsPage({ kind }: { kind: PositionKind }) {
  const ctx = await getFinanceOptions();
  const data = await getWealth();
  if (!data) return <WealthNotice />;
  const rows = data.positions.filter((p) => p.kind === kind);
  const write = ctx.role !== "viewer";
  return (
    <>
      <PageHeading
        title={positionLabels[kind]}
        description={`${ctx.profile.name} · ${kind === "investment" ? "Sua carteira registrada manualmente, com histórico real." : kind === "reserve" ? "Proteção financeira baseada no seu custo essencial." : "Planos com objetivo, prazo e histórico de movimentações."}`}
      >
        {write && (kind !== "reserve" || !rows.length) && (
          <FinanceDialog
            primary
            label={
              kind === "reserve"
                ? "Configurar reserva"
                : kind === "goal"
                  ? "Criar meta"
                  : "Adicionar investimento"
            }
            title={kind === "reserve" ? "Configurar reserva" : "Novo registro"}
          >
            <PositionForm profileId={ctx.profile.id} kind={kind} />
          </FinanceDialog>
        )}
      </PageHeading>
      {!write && <ReadOnly />}
      {!rows.length ? (
        <EmptyState
          title={
            kind === "investment"
              ? "Nenhum investimento cadastrado."
              : kind === "goal"
                ? "Você ainda não possui metas."
                : "Sua reserva ainda não foi configurada."
          }
          description="Comece definindo seu planejamento. Os valores serão calculados pelas movimentações que você registrar."
        />
      ) : (
        <>
          {kind === "investment" && (
            <>
              <div className="metric-grid analysis-metrics">
                <Metric
                  title="Total aportado"
                  value={data.investment.deposited}
                />
                <Metric
                  title="Valor atual"
                  value={data.investment.current_value}
                />
                <Metric
                  title="Resultado"
                  value={data.investment.result}
                  hint={`Retiradas: ${money(data.investment.withdrawn)}`}
                />
                <article className="metric-card">
                  <div>Rentabilidade simples</div>
                  <strong className="money-value">
                    {percent(data.investment.percentage)}
                  </strong>
                  <p>Resultado / aportes; não anualizada</p>
                </article>
              </div>
              <div className="finance-chart-grid">
                <section className="panel analysis-panel">
                  <h2>Distribuição da carteira</h2>
                  <AllocationChart
                    data={data.allocation.map((a) => ({
                      ...a,
                      name:
                        investmentTypes[
                          a.name as keyof typeof investmentTypes
                        ] ?? a.name,
                    }))}
                  />
                </section>
                <section className="panel analysis-panel">
                  <h2>Evolução dos investimentos</h2>
                  <WealthEvolution data={data.investment_history} />
                </section>
              </div>
            </>
          )}
          <div
            className={kind === "reserve" ? "reserve-layout" : "wealth-grid"}
          >
            {rows.map((p) => (
              <article className="panel wealth-position" key={p.id}>
                <div className="section-heading">
                  <h2>{p.name}</h2>
                  <span
                    className={`status-badge status-${p.status === "archived" ? "cancelled" : p.status === "completed" ? "completed" : "pending"}`}
                  >
                    {p.status === "archived"
                      ? "Arquivada"
                      : p.status === "completed"
                        ? "Concluída"
                        : "Ativa"}
                  </span>
                </div>
                {p.description && <p className="muted">{p.description}</p>}
                {kind === "investment" && (
                  <p className="muted">
                    {
                      investmentTypes[
                        p.investment_type as keyof typeof investmentTypes
                      ]
                    }{" "}
                    · {p.institution} {p.ticker}
                  </p>
                )}
                <dl className="analysis-totals">
                  <div>
                    <dt>
                      {kind === "reserve"
                        ? "Reserva atual"
                        : kind === "goal"
                          ? "Acumulado"
                          : "Valor atual"}
                    </dt>
                    <dd>{money(p.current_value)}</dd>
                  </div>
                  {kind === "investment" ? (
                    <>
                      <div>
                        <dt>Aportado / retirado</dt>
                        <dd>
                          {money(p.deposited)} / {money(p.withdrawn)}
                        </dd>
                      </div>
                      <div>
                        <dt>Resultado</dt>
                        <dd
                          className={
                            p.result.startsWith("-")
                              ? "wealth-negative"
                              : "wealth-positive"
                          }
                        >
                          {money(p.result)}
                        </dd>
                      </div>
                      <div>
                        <dt>Rentabilidade simples</dt>
                        <dd>{percent(p.return_percentage)}</dd>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <dt>
                          {kind === "reserve" ? "Reserva ideal" : "Objetivo"}
                        </dt>
                        <dd>{money(p.target ?? "0")}</dd>
                      </div>
                      <div>
                        <dt>Quanto falta</dt>
                        <dd>{money(p.remaining)}</dd>
                      </div>
                      {kind === "reserve" && (
                        <>
                          <div>
                            <dt>Meses já cobertos</dt>
                            <dd>
                              {p.months_covered?.replace(".", ",")} de{" "}
                              {p.target_months}
                            </dd>
                          </div>
                          <div>
                            <dt>Custo essencial mensal</dt>
                            <dd>{money(p.essential_cost ?? "0")}</dd>
                          </div>
                        </>
                      )}
                      {p.target_date && (
                        <div>
                          <dt>Data alvo</dt>
                          <dd>{formatDate(p.target_date)}</dd>
                        </div>
                      )}
                    </>
                  )}
                </dl>
                {kind !== "investment" && <WealthProgress value={p.progress} />}
                <div className="row-actions">
                  {write && p.status !== "archived" && (
                    <>
                      <FinanceDialog
                        primary
                        label="Movimentar"
                        title={`${p.name} · movimentação`}
                      >
                        <MovementForm
                          profileId={ctx.profile.id}
                          position={p}
                          accounts={ctx.accounts}
                        />
                      </FinanceDialog>
                      <FinanceDialog label="Editar" title="Editar configuração">
                        <PositionForm
                          profileId={ctx.profile.id}
                          kind={kind}
                          position={p}
                        />
                      </FinanceDialog>
                      {kind === "goal" && p.status === "active" && (
                        <PositionStatus
                          profileId={ctx.profile.id}
                          position={p}
                          status="completed"
                          label="Concluir meta"
                        />
                      )}
                    </>
                  )}
                  {ctx.role === "owner" && kind !== "reserve" && (
                    <PositionStatus
                      profileId={ctx.profile.id}
                      position={p}
                      status={p.status === "archived" ? "active" : "archived"}
                      label={p.status === "archived" ? "Reativar" : "Arquivar"}
                    />
                  )}
                  <Link className="text-link" href={`/app/posicoes/${p.id}`}>
                    Ver histórico →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      <p className="finance-footnote">
        Aportes transferem saldo de uma conta para esta posição; retiradas
        devolvem saldo à conta. Esses movimentos não são receitas/despesas de
        consumo.{" "}
        {kind === "investment"
          ? "Rendimentos e proventos são reinvestidos; ajuste atualiza o valor total. Sem cotações automáticas."
          : kind === "reserve"
            ? "A reserva é separada dos investimentos. Não registre o mesmo dinheiro duas vezes."
            : "Metas concluídas continuam no patrimônio até a retirada do saldo."}
      </p>
      {!ctx.accounts.length && (
        <Link className="button secondary" href="/app/contas">
          Cadastre uma conta para registrar aportes
        </Link>
      )}
    </>
  );
}
