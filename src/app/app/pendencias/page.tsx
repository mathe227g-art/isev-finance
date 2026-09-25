import Link from "next/link";
import { getFinanceOptions } from "@/services/finance";
import {
  normalizeParams,
  type SearchParams,
} from "@/components/finance/transaction-page";
import { dateSchema, today } from "@/lib/finance";
import { PageHeading, PhaseTwoNotice } from "@/components/finance/shared";
import { PhaseThreeNotice } from "@/components/finance/insights";
import { TransactionTable } from "@/components/finance/transactions";
export default async function DuePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const p = await normalizeParams(searchParams);
  const ctx = await getFinanceOptions();
  if (!ctx.ready) return <PhaseTwoNotice />;
  const type = p.type === "income" ? "income" : "expense";
  const start = dateSchema.safeParse(p.from),
    end = dateSchema.safeParse(p.to);
  const from = start.success ? start.data : today(),
    to = end.success && end.data >= from ? end.data : "2100-12-31";
  const page = Math.min(100000, Math.max(1, parseInt(p.page ?? "1") || 1));
  const { data, error } = await ctx.supabase.rpc("finance_due", {
    p_profile: ctx.profile.id,
    p_type: type,
    p_from: from,
    p_to: to,
    p_page: page,
  });
  if (error) {
    if (error.code === "PGRST202") return <PhaseThreeNotice />;
    throw new Error("Não foi possível carregar os vencimentos.");
  }
  const href = (next: number) =>
    `/app/pendencias?${new URLSearchParams({ type, from, to, page: String(next) })}`;
  return (
    <>
      <PageHeading
        title={type === "expense" ? "Contas a pagar" : "Contas a receber"}
        description={`${ctx.profile.name} · Pendências por vencimento; inclui atrasadas no intervalo escolhido.`}
      />
      {type === "expense" && (
        <p className="field-hint">
          Esta lista mostra pendências em conta.{" "}
          <Link className="text-link" href="/app/cartoes">
            Veja faturas de cartão no módulo Cartões.
          </Link>
        </p>
      )}
      <form method="get" className="panel filter-form">
        <label>
          Tipo
          <select name="type" defaultValue={type}>
            <option value="expense">A pagar</option>
            <option value="income">A receber</option>
          </select>
        </label>
        <label>
          Vencimento inicial
          <input type="date" name="from" defaultValue={from} required />
        </label>
        <label>
          Vencimento final
          <input type="date" name="to" defaultValue={to} required />
        </label>
        <button className="button primary">Filtrar</button>
      </form>
      <section className="panel transaction-panel">
        {data.rows.length ? (
          <TransactionTable
            rows={data.rows}
            profileId={ctx.profile.id}
            accounts={ctx.accounts}
            categories={ctx.categories}
            role={ctx.role}
          />
        ) : (
          <div className="empty-chart">
            Nenhuma conta pendente neste período.
          </div>
        )}
        <nav className="pagination" aria-label="Paginação">
          <span>
            {data.total} lançamentos · página {page}
          </span>
          <div className="row-actions">
            {page > 1 && (
              <Link className="button secondary" href={href(page - 1)}>
                Anterior
              </Link>
            )}
            {page * 30 < data.total && (
              <Link className="button secondary" href={href(page + 1)}>
                Próxima
              </Link>
            )}
          </div>
        </nav>
      </section>
    </>
  );
}
