"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import {
  saveAccount,
  deleteAccount,
  saveCategory,
  deleteCategory,
  addSuggestions,
  saveTransaction,
  removeTransaction,
  saveRecurrence,
  cancelRecurrence,
  generateOccurrences,
} from "@/app/actions/finance";
import {
  accountKinds,
  icons,
  frequencies,
  moneyInput,
  monthRange,
  currentMonth,
  shiftMonth,
  today,
} from "@/lib/finance";
import type {
  Account,
  Category,
  TransactionRow,
  Recurrence,
} from "@/types/finance";
import type { FormState } from "@/lib/validation";
import { SubmitButton } from "@/components/submit-button";
type Action = (state: FormState, form: FormData) => Promise<FormState>;
export function ActionForm({
  action,
  profileId,
  id,
  children,
  submit = "Salvar",
  className = "form-stack",
}: {
  action: Action;
  profileId: string;
  id?: string;
  children?: React.ReactNode;
  submit?: string;
  className?: string;
}) {
  const [state, submitAction] = useActionState(action, {});
  const router = useRouter();
  useEffect(() => {
    if (state.success) router.refresh();
  }, [state, router]);
  return (
    <form action={submitAction} className={className}>
      <input type="hidden" name="financial_profile_id" value={profileId} />
      {id && <input type="hidden" name="id" value={id} />}
      {children}
      {state.error && (
        <p className="feedback error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="feedback success" role="status">
          {state.success}
        </p>
      )}
      <SubmitButton>{submit}</SubmitButton>
    </form>
  );
}
export function FinanceDialog({
  label,
  title,
  children,
  primary = false,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className={primary ? "button primary" : "button secondary compact"}
        onClick={() => {
          setOpen(true);
          ref.current?.showModal();
        }}
      >
        {primary && <Plus size={17} />} {label}
      </button>
      <dialog
        ref={ref}
        className="finance-dialog"
        aria-label={title}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) ref.current?.close();
        }}
      >
        <div className="dialog-inner">
          <div className="section-heading">
            <h2>{title}</h2>
            <button
              type="button"
              className="icon-button"
              aria-label="Fechar"
              onClick={() => ref.current?.close()}
            >
              <X size={21} />
            </button>
          </div>
          {open && children}
        </div>
      </dialog>
    </>
  );
}
export function ConfirmAction({
  profileId,
  id,
  action,
  label,
  message,
  operation,
}: {
  profileId: string;
  id: string;
  action: Action;
  label: string;
  message: string;
  operation?: string;
}) {
  return (
    <FinanceDialog label={label} title={`${label}?`}>
      <ActionForm
        action={action}
        profileId={profileId}
        id={id}
        submit={`Confirmar ${label.toLowerCase()}`}
      >
        <p className="muted">{message}</p>
        {operation && (
          <input type="hidden" name="operation" value={operation} />
        )}
        <label className="confirmation-check">
          <input type="checkbox" required name="confirmed" value="yes" /> Li e
          confirmo esta ação.
        </label>
      </ActionForm>
    </FinanceDialog>
  );
}
export function AccountForm({
  profileId,
  account,
}: {
  profileId: string;
  account?: Account;
}) {
  return (
    <ActionForm action={saveAccount} profileId={profileId} id={account?.id}>
      <label>
        Nome
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={account?.name}
          placeholder="Ex.: Nubank ou Carteira"
        />
      </label>
      <label>
        Instituição (opcional)
        <input
          name="institution"
          maxLength={100}
          defaultValue={account?.institution ?? ""}
        />
      </label>
      <div className="form-grid">
        <label>
          Tipo
          <select name="kind" defaultValue={account?.kind ?? "checking"}>
            {Object.entries(accountKinds).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Moeda
          <select name="currency" defaultValue="BRL">
            <option value="BRL">Real brasileiro · BRL</option>
          </select>
        </label>
      </div>
      <label>
        Saldo inicial (R$)
        <input
          name="opening_balance"
          inputMode="decimal"
          required
          defaultValue={account ? moneyInput(account.opening_balance) : "0,00"}
          placeholder="2.500,00"
        />
      </label>
      <p className="field-hint">
        Valor anterior aos lançamentos. O saldo atual é calculado; alterar o
        saldo inicial ajusta a base de todo o histórico.
      </p>
    </ActionForm>
  );
}
export function AccountDelete({
  profileId,
  account,
}: {
  profileId: string;
  account: Account;
}) {
  return (
    <ConfirmAction
      action={deleteAccount}
      profileId={profileId}
      id={account.id}
      label="Excluir"
      message={`Excluir “${account.name}”? Contas com lançamentos ou recorrências não podem ser excluídas.`}
    />
  );
}
export function CategoryForm({
  profileId,
  category,
}: {
  profileId: string;
  category?: Category;
}) {
  return (
    <ActionForm action={saveCategory} profileId={profileId} id={category?.id}>
      <label>
        Nome
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={category?.name}
        />
      </label>
      <label>
        Tipo
        <select name="kind" defaultValue={category?.kind ?? "expense"}>
          <option value="expense">Despesa</option>
          <option value="income">Receita</option>
        </select>
      </label>
      <div className="form-grid">
        <label>
          Cor
          <input
            type="color"
            name="color"
            defaultValue={category?.color ?? "#087DF0"}
          />
        </label>
        <label>
          Ícone
          <select name="icon" defaultValue={category?.icon ?? "tag"}>
            {Object.entries(icons).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="field-hint">
        Categorias utilizadas mantêm o vínculo com o histórico e não podem
        trocar de tipo.
      </p>
    </ActionForm>
  );
}
export function CategoryDelete({
  profileId,
  category,
}: {
  profileId: string;
  category: Category;
}) {
  return (
    <ConfirmAction
      action={deleteCategory}
      profileId={profileId}
      id={category.id}
      label="Excluir"
      message={`Excluir “${category.name}”? Categorias usadas em lançamentos ou recorrências serão preservadas.`}
    />
  );
}
export function Suggestions({ profileId }: { profileId: string }) {
  return (
    <ActionForm
      action={addSuggestions}
      profileId={profileId}
      submit="Adicionar categorias sugeridas"
    />
  );
}
type Options = {
  profileId: string;
  accounts: Account[];
  categories: Category[];
};
function AccountSelect({
  accounts,
  name = "account_id",
  label = "Conta",
  defaultValue,
}: {
  accounts: Account[];
  name?: string;
  label?: string;
  defaultValue?: string | null;
}) {
  return (
    <label>
      {label}
      <select name={name} required defaultValue={defaultValue ?? ""}>
        <option value="" disabled>
          Selecione uma conta
        </option>
        {accounts.map((a) => (
          <option value={a.id} key={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function TransactionForm({
  profileId,
  accounts,
  categories,
  transaction,
  initialType = "expense",
}: Options & {
  transaction?: TransactionRow;
  initialType?: "income" | "expense" | "transfer";
}) {
  const [type, setType] = useState(transaction?.type ?? initialType);
  return (
    <ActionForm
      action={saveTransaction}
      profileId={profileId}
      id={transaction?.id}
      submit={transaction ? "Salvar alterações" : "Adicionar lançamento"}
    >
      <label>
        Tipo
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
        >
          {(transaction?.recurring_transaction_id
            ? [transaction.type]
            : ["income", "expense", "transfer"]
          ).map((v) => (
            <option value={v} key={v}>
              {v === "income"
                ? "Receita"
                : v === "expense"
                  ? "Despesa"
                  : "Transferência"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Descrição
        <input
          name="description"
          required
          minLength={2}
          maxLength={160}
          defaultValue={transaction?.description}
        />
      </label>
      <label>
        Valor (R$)
        <input
          name="amount"
          inputMode="decimal"
          required
          defaultValue={transaction ? moneyInput(transaction.amount) : ""}
          placeholder="0,00"
        />
      </label>
      <AccountSelect
        accounts={accounts}
        defaultValue={transaction?.account_id}
        label={
          type === "income"
            ? "Conta de destino"
            : type === "transfer"
              ? "Conta de origem"
              : "Conta"
        }
      />
      {type === "transfer" ? (
        <>
          <AccountSelect
            accounts={accounts}
            name="destination_account_id"
            label="Conta de destino"
            defaultValue={transaction?.destination_account_id}
          />
          <input name="category_id" type="hidden" value="" />
          <p className="field-hint">
            Movimentação interna: não entra em receitas, despesas ou resultado.
          </p>
        </>
      ) : (
        <>
          <input name="destination_account_id" type="hidden" value="" />
          <label>
            Categoria
            <select
              key={type}
              name="category_id"
              required
              defaultValue={
                transaction?.type === type
                  ? (transaction.category_id ?? "")
                  : ""
              }
            >
              <option value="" disabled>
                Selecione uma categoria
              </option>
              {categories
                .filter((c) => c.kind === type)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          {!categories.some((c) => c.kind === type) && (
            <p className="feedback neutral">
              Crie uma categoria de {type === "income" ? "receita" : "despesa"}{" "}
              antes de salvar.
            </p>
          )}
        </>
      )}
      <div className="form-grid">
        <label>
          Data do lançamento
          <input
            type="date"
            name="transaction_date"
            required
            defaultValue={transaction?.transaction_date ?? today()}
          />
        </label>
        <label>
          Vencimento (opcional)
          <input
            type="date"
            name="due_date"
            defaultValue={transaction?.due_date ?? ""}
          />
        </label>
      </div>
      <label>
        Situação
        <select name="status" defaultValue={transaction?.status ?? "pending"}>
          <option value="pending">Pendente</option>
          <option value="completed">
            {type === "income"
              ? "Recebido"
              : type === "expense"
                ? "Pago"
                : "Efetivada"}
          </option>
          {transaction?.status === "cancelled" && (
            <option value="cancelled">Cancelada</option>
          )}
        </select>
      </label>
      {accounts.some((a) => a.phase_three_ready) && type === "expense" && (
        <ExpenseKind value={transaction?.expense_kind} />
      )}
      <p className="field-hint">
        Lançamentos futuros devem permanecer pendentes. Apenas os concluídos
        alteram o saldo disponível.
      </p>
      <label>
        Observações
        <textarea
          name="notes"
          maxLength={2000}
          defaultValue={transaction?.notes ?? ""}
        />
      </label>
    </ActionForm>
  );
}
export function TransactionRemove({
  profileId,
  transaction,
  owner,
}: {
  profileId: string;
  transaction: TransactionRow;
  owner: boolean;
}) {
  return (
    <div className="row-actions">
      {transaction.status !== "cancelled" && (
        <ConfirmAction
          action={removeTransaction}
          profileId={profileId}
          id={transaction.id}
          operation="cancel"
          label="Cancelar"
          message={`Cancelar “${transaction.description}”? O registro será mantido e seu efeito no saldo será removido.`}
        />
      )}{" "}
      {owner && !transaction.recurring_transaction_id && (
        <ConfirmAction
          action={removeTransaction}
          profileId={profileId}
          id={transaction.id}
          operation="delete"
          label="Excluir"
          message={`Excluir permanentemente “${transaction.description}”? Isso remove o histórico deste lançamento e recalcula os saldos. Uma transferência será removida das duas contas.`}
        />
      )}
    </div>
  );
}
export function RecurrenceForm({ profileId, accounts, categories }: Options) {
  const [type, setType] = useState<"income" | "expense">("expense");
  return (
    <ActionForm
      action={saveRecurrence}
      profileId={profileId}
      submit="Salvar recorrência"
    >
      <label>
        Tipo
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
        >
          <option value="expense">Despesa recorrente</option>
          <option value="income">Receita recorrente</option>
        </select>
      </label>
      <label>
        Descrição
        <input
          name="description"
          required
          minLength={2}
          maxLength={160}
          placeholder="Ex.: Aluguel ou salário"
        />
      </label>
      <label>
        Valor (R$)
        <input
          name="amount"
          required
          inputMode="decimal"
          placeholder="1.000,00"
        />
      </label>
      <AccountSelect accounts={accounts} />
      {accounts.some((a) => a.phase_three_ready) && type === "expense" && (
        <ExpenseKind />
      )}
      <label>
        Categoria
        <select key={type} name="category_id" required defaultValue="">
          <option value="" disabled>
            Selecione
          </option>
          {categories
            .filter((c) => c.kind === type)
            .map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </label>
      <div className="form-grid">
        <label>
          Frequência
          <select name="frequency" defaultValue="monthly">
            {Object.entries(frequencies).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dia do vencimento
          <input
            type="number"
            name="due_day"
            required
            min={1}
            max={31}
            defaultValue={Number(today().slice(-2))}
          />
        </label>
      </div>
      <p className="field-hint">
        Na semanal, vale o dia da semana da data inicial. Nos demais casos, dias
        29–31 se ajustam ao último dia de meses mais curtos.
      </p>
      <div className="form-grid">
        <label>
          Data inicial
          <input
            type="date"
            name="start_date"
            required
            defaultValue={today()}
          />
        </label>
        <label>
          Data final (opcional)
          <input type="date" name="end_date" />
        </label>
      </div>
      <label>
        Observações
        <textarea name="notes" maxLength={2000} />
      </label>
    </ActionForm>
  );
}
export function ExpenseKind({
  value = "variable",
}: {
  value?: "fixed" | "variable";
}) {
  return (
    <label>
      Classificação da despesa
      <select name="expense_kind" defaultValue={value}>
        <option value="variable">Variável</option>
        <option value="fixed">Fixa</option>
      </select>
      <span className="field-hint">
        Recorrência e classificação são independentes.
      </span>
    </label>
  );
}
export function GenerateForm({ profileId }: { profileId: string }) {
  return (
    <ActionForm
      action={generateOccurrences}
      profileId={profileId}
      submit="Gerar previsões"
    >
      <div className="form-grid">
        <label>
          De
          <input
            type="date"
            name="from"
            required
            defaultValue={monthRange().from}
          />
        </label>
        <label>
          Até
          <input
            type="date"
            name="to"
            required
            defaultValue={monthRange(shiftMonth(currentMonth(), 2)).to}
          />
        </label>
      </div>
      <p className="field-hint">
        Gera todas as recorrências ativas deste perfil. Até 366 dias por vez e
        no máximo um ano à frente. Pode repetir: lançamentos existentes não
        serão duplicados.
      </p>
    </ActionForm>
  );
}
export function RecurrenceCancel({
  profileId,
  recurrence,
}: {
  profileId: string;
  recurrence: Recurrence;
}) {
  return (
    <ConfirmAction
      profileId={profileId}
      id={recurrence.id}
      action={cancelRecurrence}
      label="Cancelar recorrência"
      message={`Cancelar “${recurrence.description}” e suas parcelas pendentes de hoje em diante? Valores concluídos e pendências anteriores a hoje serão preservados. Para retomar, crie uma nova recorrência.`}
    />
  );
}
