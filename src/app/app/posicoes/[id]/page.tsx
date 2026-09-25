import Link from "next/link";
import { notFound } from "next/navigation";
import { getFinanceOptions } from "@/services/finance";
import { getWealth, getPositionHistory } from "@/services/wealth";
import { PageHeading } from "@/components/finance/shared";
import { FinanceDialog } from "@/components/finance/forms";
import { WealthNotice } from "@/components/wealth/shared";
import { MovementForm } from "@/components/wealth/forms";
import {
  normalizeParams,
  type SearchParams,
} from "@/components/finance/transaction-page";
import { movementTypes, positionPaths } from "@/lib/wealth";
import { money, formatDate } from "@/lib/finance";
import { uuidSchema } from "@/lib/validation";
export default async function PositionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const ctx = await getFinanceOptions(),
    data = await getWealth();
  if (!data) return <WealthNotice />;
  const position = data.positions.find((p) => p.id === id);
  if (!position) notFound();
  const p = await normalizeParams(searchParams);
  const page = Math.min(100000, Math.max(1, parseInt(p.page ?? "1") || 1));
  const history = await getPositionHistory(id, page);
  return (
    <>
      <PageHeading
        title={position.name}
        description={`Saldo atual: ${money(position.current_value)} · Histórico preservado.`}
      >
        <Link className="button secondary" href={positionPaths[position.kind]}>
          Voltar
        </Link>
        {ctx.role !== "viewer" && position.status !== "archived" && (
          <FinanceDialog primary label="Movimentar" title="Nova movimentação">
            <MovementForm
              profileId={ctx.profile.id}
              position={position}
              accounts={ctx.accounts}
            />
          </FinanceDialog>
        )}
      </PageHeading>
      <section className="panel transaction-panel">
        {history.rows.length ? (
          <div className="table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Movimentação</th>
                  <th>Valor informado</th>
                  <th>Efeito na posição</th>
                  <th>Conta / observação</th>
                </tr>
              </thead>
              <tbody>
                {history.rows.map((m) => (
                  <tr key={m.id}>
                    <td data-label="Data">{formatDate(m.movement_date)}</td>
                    <td data-label="Tipo">
                      {movementTypes[m.kind as keyof typeof movementTypes]}
                    </td>
                    <td data-label="Valor">{money(m.amount)}</td>
                    <td
                      data-label="Efeito"
                      className={
                        m.delta.startsWith("-")
                          ? "wealth-negative"
                          : "wealth-positive"
                      }
                    >
                      {money(m.delta)}
                    </td>
                    <td data-label="Conta">
                      {m.account_name ?? "Sem movimentação de conta"}
                      <small>{m.notes}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-chart">Nenhuma movimentação registrada.</div>
        )}
        <nav className="pagination" aria-label="Histórico">
          <span>
            {history.total} registros · página {page}
          </span>
          <div className="row-actions">
            {page > 1 && <Link href={`?page=${page - 1}`}>Anterior</Link>}
            {page * 30 < history.total && (
              <Link href={`?page=${page + 1}`}>Próxima</Link>
            )}
          </div>
        </nav>
      </section>
      <p className="finance-footnote">
        O histórico não é apagado nem editado. Corrija uma posição com
        retirada/aporte compensatório ou ajuste de valor atual, conforme o tipo.
        Ajuste de investimento é avaliação da posição, não movimentação de
        caixa.
      </p>
    </>
  );
}
