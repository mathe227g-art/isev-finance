import { getFinanceOptions } from "@/services/finance";
import {
  PageHeading,
  PhaseTwoNotice,
  EmptyState,
  ReadOnly,
} from "@/components/finance/shared";
import {
  FinanceDialog,
  AccountForm,
  AccountDelete,
} from "@/components/finance/forms";
import { accountKinds, money } from "@/lib/finance";
export default async function Accounts() {
  const ctx = await getFinanceOptions();
  if (!ctx.ready) return <PhaseTwoNotice />;
  const write = ctx.role !== "viewer";
  return (
    <>
      <PageHeading
        title="Contas e carteiras"
        description={`Saldos e movimentações de ${ctx.profile.name}.`}
      >
        {write && (
          <FinanceDialog
            label="Nova conta"
            title="Criar conta ou carteira"
            primary
          >
            <AccountForm profileId={ctx.profile.id} />
          </FinanceDialog>
        )}
      </PageHeading>
      {!write && <ReadOnly />}
      {!ctx.accounts.length ? (
        <EmptyState
          title="Você ainda não possui nenhuma conta."
          description="Adicione uma conta ou carteira para começar a registrar seus lançamentos."
        >
          {write && (
            <FinanceDialog
              label="Criar primeira conta"
              title="Sua primeira conta"
              primary
            >
              <AccountForm profileId={ctx.profile.id} />
            </FinanceDialog>
          )}
        </EmptyState>
      ) : (
        <>
          <div className="accounts-grid">
            {ctx.accounts.map((a) => (
              <article key={a.id} className="panel account-card">
                <span className="phase-tag">{accountKinds[a.kind]}</span>
                <h2>{a.name}</h2>
                <p className="muted">
                  {a.institution || "Sem instituição"} · {a.currency}
                </p>
                <dl>
                  <div>
                    <dt>Saldo atual</dt>
                    <dd>{money(a.current_balance)}</dd>
                  </div>
                  <div>
                    <dt>Saldo previsto</dt>
                    <dd>{money(a.projected_balance)}</dd>
                  </div>
                  <div>
                    <dt>Saldo inicial</dt>
                    <dd>{money(a.opening_balance)}</dd>
                  </div>
                </dl>
                {write && (
                  <div className="row-actions">
                    <FinanceDialog label="Editar" title={`Editar ${a.name}`}>
                      <AccountForm profileId={ctx.profile.id} account={a} />
                    </FinanceDialog>
                    {ctx.role === "owner" && (
                      <AccountDelete profileId={ctx.profile.id} account={a} />
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
          <p className="finance-footnote">
            Saldo atual inclui lançamentos concluídos, pagamentos de fatura e
            aportes/retiradas. O previsto por conta acrescenta pendências em
            conta; faturas ainda não pagas ficam na previsão mensal da visão
            geral, pois a conta de pagamento pode mudar. Recorrências não
            geradas não entram na projeção.
          </p>
        </>
      )}
    </>
  );
}
