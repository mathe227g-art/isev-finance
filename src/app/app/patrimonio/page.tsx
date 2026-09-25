import { getFinanceOptions } from "@/services/finance";
import { getWealth } from "@/services/wealth";
import {
  PageHeading,
  Metric,
  EmptyState,
  ReadOnly,
} from "@/components/finance/shared";
import { ActionForm, FinanceDialog } from "@/components/finance/forms";
import { WorthItemForm, ArchiveItem } from "@/components/wealth/forms";
import { WealthNotice } from "@/components/wealth/shared";
import {
  AllocationChart,
  AssetsLiabilities,
  WealthEvolution,
} from "@/components/wealth/charts";
import { saveSnapshot } from "@/app/actions/wealth";
import { money } from "@/lib/finance";
import { itemTypes } from "@/lib/wealth";
export default async function WorthPage() {
  const ctx = await getFinanceOptions(),
    data = await getWealth();
  if (!data) return <WealthNotice />;
  const write = ctx.role !== "viewer",
    n = data.net_worth;
  return (
    <>
      <PageHeading
        title="Patrimônio"
        description={`${ctx.profile.name} · Bens, posições financeiras e obrigações.`}
      >
        {write && (
          <>
            <FinanceDialog primary label="Adicionar bem" title="Novo bem">
              <WorthItemForm profileId={ctx.profile.id} />
            </FinanceDialog>
            <FinanceDialog label="Adicionar dívida" title="Nova dívida">
              <WorthItemForm
                profileId={ctx.profile.id}
                initialKind="liability"
              />
            </FinanceDialog>
          </>
        )}
      </PageHeading>
      {!write && <ReadOnly />}
      <div className="metric-grid finance-metrics">
        <Metric title="Ativos" value={n.assets} />
        <Metric title="Passivos" value={n.liabilities} />
        <Metric
          title="Patrimônio líquido"
          value={n.net_worth}
          hint="Ativos − passivos"
        />
      </div>
      <section className="panel analysis-panel">
        <h2>Como seu patrimônio é composto</h2>
        <dl className="analysis-totals">
          <div>
            <dt>Contas positivas</dt>
            <dd>{money(n.accounts)}</dd>
          </div>
          <div>
            <dt>Investimentos</dt>
            <dd>{money(n.investments)}</dd>
          </div>
          <div>
            <dt>Metas e reserva</dt>
            <dd>
              {money(n.goals)} + {money(n.reserves)}
            </dd>
          </div>
          <div>
            <dt>Bens manuais</dt>
            <dd>{money(n.goods)}</dd>
          </div>
          <div>
            <dt>Dívidas manuais</dt>
            <dd>{money(n.manual_debts)}</dd>
          </div>
          <div>
            <dt>Parcelas de cartão em aberto</dt>
            <dd>{money(n.card_debt)}</dd>
          </div>
          <div>
            <dt>Contas negativas</dt>
            <dd>{money(n.overdraft)}</dd>
          </div>
        </dl>
        <p className="field-hint">
          Contas e posições entram automaticamente. Registre manualmente apenas
          bens/dívidas que ainda não estejam nesses módulos. Pendências comuns
          de caixa não são presumidas como dívidas patrimoniais.
        </p>
      </section>
      <div className="finance-chart-grid">
        <section className="panel analysis-panel">
          <h2>Composição dos ativos</h2>
          <AllocationChart
            data={[
              { name: "Contas", value: n.accounts },
              { name: "Investimentos", value: n.investments },
              { name: "Metas", value: n.goals },
              { name: "Reserva", value: n.reserves },
              { name: "Bens manuais", value: n.goods },
            ]}
          />
        </section>
        <section className="panel analysis-panel">
          <h2>Ativos x passivos</h2>
          <AssetsLiabilities assets={n.assets} liabilities={n.liabilities} />
        </section>
      </div>
      <section className="panel analysis-panel">
        <div className="section-heading">
          <h2>Evolução patrimonial</h2>
          {write && (
            <ActionForm
              action={saveSnapshot}
              profileId={ctx.profile.id}
              submit="Registrar posição de hoje"
            />
          )}
        </div>
        <p className="field-hint">
          Fotografias calculadas a partir dos seus registros. Um registro por
          dia; atualizar hoje substitui apenas a fotografia de hoje.
        </p>
        <WealthEvolution data={data.snapshots} />
      </section>
      {!data.items.length ? (
        <EmptyState
          title="Adicione seus bens para acompanhar seu patrimônio."
          description="Contas, posições financeiras e dívidas de cartão já estão no cálculo acima."
        />
      ) : (
        <section className="panel transaction-panel">
          <h2>Bens e dívidas cadastrados</h2>
          <div className="table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Valor atual</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.id}>
                    <td data-label="Nome">
                      <strong>{i.name}</strong>
                      <small>{i.notes}</small>
                    </td>
                    <td data-label="Tipo">
                      {i.kind === "asset" ? "Ativo" : "Passivo"} ·{" "}
                      {itemTypes[i.category as keyof typeof itemTypes]}
                    </td>
                    <td data-label="Valor">{money(i.amount)}</td>
                    <td data-label="Situação">
                      {i.active ? "Ativo" : "Arquivado"}
                    </td>
                    <td data-label="Ações">
                      <div className="row-actions">
                        {write && i.active && (
                          <FinanceDialog
                            label="Editar"
                            title="Editar valor patrimonial"
                          >
                            <WorthItemForm
                              profileId={ctx.profile.id}
                              item={i}
                            />
                          </FinanceDialog>
                        )}
                        {ctx.role === "owner" && (
                          <ArchiveItem profileId={ctx.profile.id} item={i} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
