"use client";
import { useState, useRef, useCallback } from "react";
import type { FormState } from "@/lib/validation";
import {
  ActionForm,
  FinanceDialog,
  TransactionForm,
} from "@/components/finance/forms";
import {
  saveWealth,
  registerPurchase,
  payInvoice,
  movePosition,
} from "@/app/actions/wealth";
import { investmentTypes, itemTypes, movementTypes } from "@/lib/wealth";
import { today, moneyInput, money } from "@/lib/finance";
import type { Account, Category } from "@/types/finance";
import type {
  Card,
  Position,
  PositionKind,
  WorthItem,
  Invoice,
} from "@/types/wealth";
function Text({
  name,
  label,
  value = "",
  required = false,
  max = 100,
}: {
  name: string;
  label: string;
  value?: string;
  required?: boolean;
  max?: number;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        defaultValue={value}
        required={required}
        maxLength={max}
      />
    </label>
  );
}
function Money({
  name,
  label,
  value = "",
}: {
  name: string;
  label: string;
  value?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        inputMode="decimal"
        defaultValue={value ? moneyInput(value) : ""}
        placeholder="0,00"
        required
      />
    </label>
  );
}
function Accounts({
  accounts,
  value,
}: {
  accounts: Account[];
  value?: string;
}) {
  return (
    <label>
      Conta
      <select name="account_id" defaultValue={value ?? ""} required>
        <option value="" disabled>
          Selecione uma conta
        </option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
  );
}
function Notes({
  name = "notes",
  value = "",
}: {
  name?: string;
  value?: string;
}) {
  return (
    <label>
      Observações
      <textarea name={name} defaultValue={value} maxLength={2000} />
    </label>
  );
}
function Hidden({ values }: { values: Record<string, unknown> }) {
  return (
    <>
      {Object.entries(values).map(([k, v]) => (
        <input
          type="hidden"
          key={k}
          name={k}
          value={v === null || v === undefined ? "" : String(v)}
        />
      ))}
    </>
  );
}
function RequestKey() {
  const key = useRef("");
  const assign = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      key.current ||= crypto.randomUUID();
      node.defaultValue = key.current;
      node.value = key.current;
    }
  }, []);
  return <input type="hidden" name="request_id" ref={assign} />;
}
export function CardForm({
  profileId,
  accounts,
  card,
}: {
  profileId: string;
  accounts: Account[];
  card?: Card;
}) {
  return (
    <ActionForm action={saveWealth} profileId={profileId} id={card?.id}>
      <Hidden values={{ entity: "card", active: card?.active ?? true }} />
      <Text
        name="name"
        label="Nome do cartão"
        required
        value={card?.name}
        max={80}
      />
      <div className="form-grid">
        <Text
          name="institution"
          label="Instituição"
          value={card?.institution}
        />
        <Text name="brand" label="Bandeira" value={card?.brand} max={40} />
      </div>
      <label>
        Últimos 4 dígitos (opcional)
        <input
          name="last_four"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          defaultValue={card?.last_four}
        />
      </label>
      <p className="field-hint">
        Informe somente os 4 últimos dígitos. Não cadastre número completo, CVV,
        senha ou PIN.
      </p>
      <Money
        name="credit_limit"
        label="Limite total (R$)"
        value={card?.credit_limit}
      />
      <div className="form-grid">
        <label>
          Dia de fechamento
          <input
            name="closing_day"
            type="number"
            min={1}
            max={31}
            required
            defaultValue={card?.closing_day ?? 20}
          />
        </label>
        <label>
          Dia de vencimento
          <input
            name="due_day"
            type="number"
            min={1}
            max={31}
            required
            defaultValue={card?.due_day ?? 10}
          />
        </label>
      </div>
      <label>
        Conta preferencial para pagamento
        <select
          name="payment_account_id"
          required
          defaultValue={card?.payment_account_id ?? ""}
        >
          <option value="" disabled>
            Selecione
          </option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Cor
        <input
          name="color"
          type="color"
          defaultValue={card?.color ?? "#087DF0"}
        />
      </label>
      <p className="field-hint">
        Compras no dia do fechamento entram na mesma fatura. Com histórico, os
        dias do ciclo ficam preservados.
      </p>
    </ActionForm>
  );
}
export function ArchiveCard({
  profileId,
  card,
}: {
  profileId: string;
  card: Card;
}) {
  return (
    <FinanceDialog
      label={card.active ? "Desativar" : "Reativar"}
      title={card.active ? "Desativar cartão" : "Reativar cartão"}
    >
      <ActionForm action={saveWealth} profileId={profileId} id={card.id}>
        <Hidden values={{ ...card, entity: "card", active: !card.active }} />
        <p>
          O histórico e as faturas serão preservados. Um cartão inativo não
          recebe novas compras.
        </p>
        <label className="confirmation-check">
          <input type="checkbox" required name="confirmed" value="yes" />
          Confirmo esta alteração.
        </label>
      </ActionForm>
    </FinanceDialog>
  );
}
export function PurchaseForm({
  profileId,
  cards,
  categories,
  cardId,
}: {
  profileId: string;
  cards: Card[];
  categories: Category[];
  cardId?: string;
}) {
  const [nonce, setNonce] = useState(0);
  async function submit(state: FormState, form: FormData) {
    const result = await registerPurchase(state, form);
    if (result.success) setNonce((n) => n + 1);
    return result;
  }
  return (
    <ActionForm action={submit} profileId={profileId} submit="Registrar compra">
      <RequestKey key={nonce} />
      <label>
        Cartão
        <select name="card_id" required defaultValue={cardId ?? ""}>
          <option value="" disabled>
            Selecione um cartão ativo
          </option>
          {cards
            .filter((c) => c.active)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · disponível {money(c.available)}
              </option>
            ))}
        </select>
      </label>
      <Text name="description" label="Descrição" required max={160} />
      <Money name="amount" label="Valor total da compra (R$)" />
      <label>
        Categoria
        <select name="category_id" required defaultValue="">
          <option value="" disabled>
            Selecione uma despesa
          </option>
          {categories
            .filter((c) => c.kind === "expense")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </label>
      <div className="form-grid">
        <label>
          Data da compra
          <input
            type="date"
            name="purchase_date"
            defaultValue={today()}
            max={today()}
            required
          />
        </label>
        <label>
          Parcelas
          <input
            type="number"
            name="installment_count"
            min={1}
            max={60}
            defaultValue={1}
            required
          />
        </label>
      </div>
      <label>
        Classificação
        <select name="expense_kind" defaultValue="variable">
          <option value="variable">Variável</option>
          <option value="fixed">Fixa</option>
        </select>
      </label>
      <Notes />
      <p className="field-hint">
        A despesa é reconhecida pelo valor total na data da compra. As parcelas
        distribuem a dívida nas faturas; não repetem a despesa. Até 60 parcelas,
        com centavos distribuídos exatamente.
      </p>
    </ActionForm>
  );
}
export function InvoicePayment({
  profileId,
  invoice,
  accounts,
  card,
}: {
  profileId: string;
  invoice: Invoice;
  accounts: Account[];
  card: Card;
}) {
  return (
    <FinanceDialog
      label="Registrar pagamento"
      title="Registrar liquidação da fatura"
    >
      <ActionForm
        action={payInvoice}
        profileId={profileId}
        id={invoice.id ?? undefined}
      >
        <p>
          Registrar o pagamento integral de{" "}
          <strong>{money(invoice.total)}</strong>. Esta ação apenas atualiza o
          controle financeiro; não paga o banco.
        </p>
        <Accounts accounts={accounts} value={card.payment_account_id} />
        <label>
          Data do pagamento
          <input
            name="payment_date"
            type="date"
            required
            max={today()}
            defaultValue={today()}
          />
        </label>
        <label className="confirmation-check">
          <input name="confirmed" value="yes" type="checkbox" required />
          Confirmo o registro. O saldo da conta será reduzido sem duplicar
          despesas.
        </label>
      </ActionForm>
    </FinanceDialog>
  );
}
export function PositionForm({
  profileId,
  kind,
  position,
}: {
  profileId: string;
  kind: PositionKind;
  position?: Position;
}) {
  return (
    <ActionForm action={saveWealth} profileId={profileId} id={position?.id}>
      <Hidden
        values={{
          entity: "position",
          kind,
          status: position?.status ?? "active",
          ...(kind !== "investment"
            ? { institution: "", ticker: "", investment_type: "" }
            : {}),
          ...(kind !== "goal" ? { target_amount: "" } : {}),
          ...(kind !== "reserve"
            ? { essential_cost: "", target_months: "" }
            : {}),
        }}
      />
      <Text
        name="name"
        label="Nome"
        value={
          position?.name ?? (kind === "reserve" ? "Reserva de emergência" : "")
        }
        required
      />
      <Notes name="description" value={position?.description} />
      {kind === "goal" && (
        <Money
          name="target_amount"
          label="Valor alvo (R$)"
          value={position?.target_amount ?? ""}
        />
      )}
      <label>
        {kind === "goal"
          ? "Data alvo (opcional)"
          : "Data de referência (opcional)"}
        <input
          type="date"
          name="target_date"
          defaultValue={position?.target_date ?? ""}
        />
      </label>
      {kind === "reserve" && (
        <>
          <Money
            name="essential_cost"
            label="Custo mensal essencial (R$)"
            value={position?.essential_cost ?? ""}
          />
          <label>
            Meses desejados
            <input
              type="number"
              min={1}
              max={120}
              name="target_months"
              required
              defaultValue={position?.target_months ?? 6}
            />
          </label>
        </>
      )}
      {kind === "investment" && (
        <>
          <label>
            Tipo
            <select
              name="investment_type"
              required
              defaultValue={position?.investment_type ?? "cdb"}
            >
              {Object.entries(investmentTypes).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <Text
            name="institution"
            label="Instituição"
            value={position?.institution}
          />
          <Text
            name="ticker"
            label="Ticker / código (opcional)"
            max={30}
            value={position?.ticker}
          />
        </>
      )}
      <p className="field-hint">
        O saldo é calculado pelas movimentações. Use aporte para transferir
        valor de uma conta para esta posição.
      </p>
    </ActionForm>
  );
}
export function PositionStatus({
  profileId,
  position,
  status,
  label,
}: {
  profileId: string;
  position: Position;
  status: Position["status"];
  label: string;
}) {
  return (
    <FinanceDialog label={label} title={label}>
      <ActionForm action={saveWealth} profileId={profileId} id={position.id}>
        <Hidden values={{ ...position, entity: "position", status }} />
        <p>
          O histórico será preservado. Para arquivar é necessário retirar todo o
          saldo; para concluir uma meta é necessário atingir seu objetivo.
        </p>
        <label className="confirmation-check">
          <input name="confirmed" type="checkbox" required value="yes" />
          Confirmo esta alteração.
        </label>
      </ActionForm>
    </FinanceDialog>
  );
}
export function MovementForm({
  profileId,
  position,
  accounts,
}: {
  profileId: string;
  position: Position;
  accounts: Account[];
}) {
  const [nonce, setNonce] = useState(0);
  async function submit(state: FormState, form: FormData) {
    const result = await movePosition(state, form);
    if (result.success) setNonce((n) => n + 1);
    return result;
  }
  const [kind, setKind] = useState("deposit");
  const cash = kind === "deposit" || kind === "withdrawal";
  return (
    <ActionForm
      action={submit}
      profileId={profileId}
      submit="Registrar movimentação"
    >
      <Hidden values={{ position_id: position.id }} />
      <RequestKey key={nonce} />
      <label>
        Movimentação
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {Object.entries(movementTypes)
            .filter(
              ([v]) =>
                position.kind === "investment" ||
                v === "deposit" ||
                v === "withdrawal",
            )
            .map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
        </select>
      </label>
      <Money
        name="amount"
        label={
          kind === "valuation"
            ? "Novo valor total da posição (R$)"
            : "Valor (R$)"
        }
      />
      {cash ? (
        <Accounts accounts={accounts} />
      ) : (
        <Hidden values={{ account_id: "" }} />
      )}
      <label>
        Data
        <input
          name="movement_date"
          type="date"
          required
          max={today()}
          defaultValue={today()}
        />
      </label>
      <Notes />
      <p className="field-hint">
        {cash
          ? "Aporte reduz a conta e aumenta esta posição. Retirada faz o inverso. Nenhum deles conta como receita ou despesa de consumo."
          : "Rendimentos/proventos são reinvestidos. Atualização informa o valor total da posição, não um aporte nem uma variação percentual."}{" "}
        Use data igual ou posterior à última movimentação.
      </p>
    </ActionForm>
  );
}
export function WorthItemForm({
  profileId,
  item,
  initialKind = "asset",
}: {
  profileId: string;
  item?: WorthItem;
  initialKind?: "asset" | "liability";
}) {
  const [kind, setKind] = useState(item?.kind ?? initialKind);
  const choices =
    kind === "asset"
      ? ["property", "vehicle", "business", "valuable", "cash", "other"]
      : ["financing", "loan", "debt", "other"];
  return (
    <ActionForm action={saveWealth} profileId={profileId} id={item?.id}>
      <Hidden values={{ entity: "item", active: item?.active ?? true }} />
      <label>
        Natureza
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          <option value="asset">Bem / ativo</option>
          <option value="liability">Dívida / passivo</option>
        </select>
      </label>
      <Text name="name" label="Nome" value={item?.name} required />
      <label>
        Tipo
        <select
          key={kind}
          name="category"
          defaultValue={item?.kind === kind ? item.category : choices[0]}
        >
          {choices.map((v) => (
            <option key={v} value={v}>
              {itemTypes[v as keyof typeof itemTypes]}
            </option>
          ))}
        </select>
      </label>
      <Money name="amount" label="Valor atual (R$)" value={item?.amount} />
      <Notes value={item?.notes} />
      <p className="field-hint">
        Contas, investimentos, metas, reserva e cartões já são considerados
        automaticamente. Não recadastre esses mesmos valores aqui.
      </p>
    </ActionForm>
  );
}
export function ArchiveItem({
  profileId,
  item,
}: {
  profileId: string;
  item: WorthItem;
}) {
  return (
    <FinanceDialog
      label={item.active ? "Arquivar" : "Reativar"}
      title="Alterar situação do registro"
    >
      <ActionForm action={saveWealth} profileId={profileId} id={item.id}>
        <Hidden values={{ ...item, entity: "item", active: !item.active }} />
        <p>
          Registros arquivados deixam de compor o patrimônio atual. O registro
          permanece disponível.
        </p>
        <label className="confirmation-check">
          <input name="confirmed" type="checkbox" required value="yes" />
          Confirmo a alteração.
        </label>
      </ActionForm>
    </FinanceDialog>
  );
}
export function NewEntryForm({
  profileId,
  accounts,
  categories,
  cards,
  initialType = "expense",
}: {
  profileId: string;
  accounts: Account[];
  categories: Category[];
  cards: Card[];
  initialType?: "income" | "expense" | "transfer";
}) {
  const [source, setSource] = useState("account");
  return (
    <>
      {cards.length > 0 && initialType !== "income" && (
        <label className="funding-source">
          Forma de lançamento
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="account">
              Conta — receita, despesa ou transferência
            </option>
            <option value="card">Cartão de crédito — compra</option>
          </select>
        </label>
      )}
      {source === "card" ? (
        <PurchaseForm
          profileId={profileId}
          cards={cards}
          categories={categories}
        />
      ) : (
        <TransactionForm
          profileId={profileId}
          accounts={accounts}
          categories={categories}
          initialType={initialType}
        />
      )}
    </>
  );
}
