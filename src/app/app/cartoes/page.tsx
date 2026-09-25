import Link from "next/link";
import { cardTextColor } from "@/lib/wealth";
import { getFinanceOptions } from "@/services/finance";
import { getWealth } from "@/services/wealth";
import { PageHeading, EmptyState, ReadOnly } from "@/components/finance/shared";
import { FinanceDialog } from "@/components/finance/forms";
import { CardForm, ArchiveCard, PurchaseForm } from "@/components/wealth/forms";
import {
  WealthNotice,
  WealthProgress,
  WealthAlerts,
} from "@/components/wealth/shared";
import { money, formatDate } from "@/lib/finance";
export default async function CardsPage() {
  const ctx = await getFinanceOptions();
  const data = await getWealth();
  if (!data) return <WealthNotice />;
  const write = ctx.role !== "viewer";
  return (
    <>
      <PageHeading
        title="Cartões de crédito"
        description={`${ctx.profile.name} · Limites, compras e faturas em um só lugar.`}
      >
        {write && ctx.accounts.length > 0 && (
          <FinanceDialog primary label="Adicionar cartão" title="Novo cartão">
            <CardForm profileId={ctx.profile.id} accounts={ctx.accounts} />
          </FinanceDialog>
        )}
        {write && data.cards.some((c) => c.active) && (
          <FinanceDialog label="Nova compra" title="Compra no cartão">
            <PurchaseForm
              profileId={ctx.profile.id}
              cards={data.cards}
              categories={ctx.categories}
            />
          </FinanceDialog>
        )}
      </PageHeading>
      {!write && <ReadOnly />}
      {!data.cards.length ? (
        <EmptyState
          title="Nenhum cartão cadastrado."
          description="Adicione somente informações de identificação e controle financeiro."
        >
          {!ctx.accounts.length && (
            <Link href="/app/contas" className="button primary">
              Criar conta de pagamento
            </Link>
          )}
        </EmptyState>
      ) : (
        <div className="wealth-grid">
          {data.cards.map((card) => (
            <article className="panel wealth-card" key={card.id}>
              <div
                className="credit-card-face"
                style={{
                  background: card.color,
                  color: cardTextColor(card.color),
                }}
              >
                <span>
                  {card.institution} · {card.brand}
                </span>
                <h2>{card.name}</h2>
                <strong>•••• {card.last_four || "••••"}</strong>
                <small>{card.active ? "Ativo" : "Inativo"}</small>
              </div>
              <dl className="analysis-totals">
                <div>
                  <dt>Limite total</dt>
                  <dd>{money(card.credit_limit)}</dd>
                </div>
                <div>
                  <dt>Utilizado</dt>
                  <dd>{money(card.used)}</dd>
                </div>
                <div>
                  <dt>Disponível</dt>
                  <dd>{money(card.available)}</dd>
                </div>
                <div>
                  <dt>Próxima fatura em aberto</dt>
                  <dd>{money(card.current_total)}</dd>
                </div>
                {card.due_on && (
                  <div>
                    <dt>Vencimento</dt>
                    <dd>{formatDate(card.due_on)}</dd>
                  </div>
                )}
              </dl>
              <WealthProgress
                value={card.utilization}
                label="Limite comprometido"
              />
              <div className="row-actions">
                <Link
                  href={`/app/cartoes/${card.id}`}
                  className="button primary"
                >
                  Ver faturas
                </Link>
                {write && (
                  <FinanceDialog label="Editar" title="Editar cartão">
                    <CardForm
                      profileId={ctx.profile.id}
                      accounts={ctx.accounts}
                      card={card}
                    />
                  </FinanceDialog>
                )}
                {ctx.role === "owner" && (
                  <ArchiveCard profileId={ctx.profile.id} card={card} />
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="finance-footnote">
        Todas as parcelas em aberto comprometem o limite. A liquidação de cada
        fatura libera o valor correspondente. Nenhum pagamento real é realizado
        pelo aplicativo.
      </p>
      <WealthAlerts data={data} />
    </>
  );
}
