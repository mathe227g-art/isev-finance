import Link from "next/link";
import { notFound } from "next/navigation";
import { getFinanceOptions } from "@/services/finance";
import { getWealth, getCardDetail } from "@/services/wealth";
import { PageHeading, PeriodNav, Metric } from "@/components/finance/shared";
import { FinanceDialog, ConfirmAction } from "@/components/finance/forms";
import { WealthNotice } from "@/components/wealth/shared";
import { PurchaseForm, InvoicePayment } from "@/components/wealth/forms";
import { cancelPurchase } from "@/app/actions/wealth";
import {
  normalizeParams,
  type SearchParams,
} from "@/components/finance/transaction-page";
import { money, formatDate, monthRange, today } from "@/lib/finance";
import { currentBillingMonth, invoiceStatuses } from "@/lib/wealth";
import { uuidSchema } from "@/lib/validation";
export default async function CardPage({
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
  const card = data.cards.find((c) => c.id === id);
  if (!card) notFound();
  const p = await normalizeParams(searchParams);
  const month = monthRange(
    p.month ??
      card.current_month?.slice(0, 7) ??
      currentBillingMonth(card.closing_day),
  ).month;
  const detail = await getCardDetail(id, month);
  if (!detail) notFound();
  const invoice = detail.invoice;
  return (
    <>
      <PageHeading
        title={card.name}
        description={`${ctx.profile.name} · ${card.brand} · •••• ${card.last_four || "••••"}`}
      >
        <Link href="/app/cartoes" className="button secondary">
          Todos os cartões
        </Link>
        {ctx.role !== "viewer" && card.active && (
          <FinanceDialog primary label="Nova compra" title="Compra no cartão">
            <PurchaseForm
              profileId={ctx.profile.id}
              cards={data.cards}
              categories={ctx.categories}
              cardId={id}
            />
          </FinanceDialog>
        )}
      </PageHeading>
      <div className="period-row">
        <PeriodNav month={month} path={`/app/cartoes/${id}`} />
        <Link
          className="text-link"
          href={`/app/cartoes/${id}?month=${currentBillingMonth(card.closing_day)}`}
        >
          Fatura do ciclo atual
        </Link>
      </div>
      <div className="metric-grid analysis-metrics">
        <Metric
          title="Fatura selecionada"
          value={invoice.total}
          hint={invoiceStatuses[invoice.status]}
        />
        <Metric title="Limite utilizado" value={card.used} />
        <Metric title="Limite disponível" value={card.available} />
        <article className="metric-card">
          <div>Fechamento / vencimento</div>
          <strong>{formatDate(invoice.closes_on)}</strong>
          <p>Vence em {formatDate(invoice.due_on)}</p>
        </article>
      </div>
      <div className="panel analysis-panel">
        <div className="section-heading">
          <h2>Compras desta fatura</h2>
          {ctx.role === "owner" &&
            invoice.id &&
            !invoice.paid_on &&
            invoice.closes_on < today() &&
            Number(invoice.total) > 0 && (
              <InvoicePayment
                profileId={ctx.profile.id}
                invoice={invoice}
                accounts={ctx.accounts}
                card={card}
              />
            )}
        </div>
        {invoice.paid_on && (
          <p className="feedback success">
            Pagamento registrado em {formatDate(invoice.paid_on)}
            {invoice.payment_account_name
              ? ` pela conta ${invoice.payment_account_name}`
              : ""}
            . A despesa não foi contabilizada novamente.
          </p>
        )}
        {detail.installments.length ? (
          <div className="table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Compra</th>
                  <th>Data</th>
                  <th>Parcela</th>
                  <th>Valor</th>
                  <th>Situação / ações</th>
                </tr>
              </thead>
              <tbody>
                {detail.installments.map((i) => (
                  <tr key={i.id}>
                    <td data-label="Compra">
                      <strong>{i.description}</strong>
                      <small>
                        {i.category_name} · total {money(i.purchase_total)}
                      </small>
                      {i.notes && <small>{i.notes}</small>}
                    </td>
                    <td data-label="Data">{formatDate(i.purchase_date)}</td>
                    <td data-label="Parcela">
                      {i.number}/{i.count}
                    </td>
                    <td data-label="Valor">{money(i.amount)}</td>
                    <td data-label="Ações">
                      {i.cancelled ? (
                        "Cancelada"
                      ) : invoice.paid_on ? (
                        "Liquidada"
                      ) : ctx.role === "owner" ? (
                        <ConfirmAction
                          action={cancelPurchase}
                          profileId={ctx.profile.id}
                          id={i.purchase_id}
                          label="Cancelar compra"
                          message="Cancelar a compra inteira e todas as parcelas ainda não pagas? Se qualquer parcela já foi paga, o cancelamento será bloqueado. O histórico será preservado."
                        />
                      ) : (
                        "Em aberto"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-chart">Nenhuma compra nesta competência.</div>
        )}
        <p className="finance-footnote">
          O total da fatura soma apenas suas parcelas ativas. A despesa de
          consumo foi reconhecida uma única vez na data da compra. Pagamento
          integral disponível após o fechamento.
        </p>
      </div>
    </>
  );
}
