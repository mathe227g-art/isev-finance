import Link from "next/link";
import type {
  Account,
  Category,
  TransactionRow,
  Role,
  Filters,
} from "@/types/finance";
import { money, formatDate, statuses } from "@/lib/finance";
import { FinanceDialog, TransactionForm, TransactionRemove } from "./forms";
export function TransactionTable({
  rows,
  profileId,
  accounts,
  categories,
  role,
  editable = true,
}: {
  rows: TransactionRow[];
  profileId: string;
  accounts: Account[];
  categories: Category[];
  role: Role;
  editable?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table className="finance-table">
        <thead>
          <tr>
            <th>Descrição</th>
            <th>Conta / cartão</th>
            <th>Data / vencimento</th>
            <th>Situação</th>
            <th className="numeric">Valor</th>
            {editable && role !== "viewer" && <th>Ações</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td data-label="Descrição">
                <strong>{t.description}</strong>
                <small>
                  {t.type === "transfer"
                    ? "Transferência interna"
                    : t.category_name}
                  {t.recurring_transaction_id ? " · Recorrente" : ""}
                  {t.source === "card" ? " · Compra no cartão" : ""}
                  {t.type === "expense"
                    ? t.expense_kind === "fixed"
                      ? " · Fixa"
                      : " · Variável"
                    : ""}
                </small>
              </td>
              <td data-label="Conta / cartão">
                {t.account_name}
                {t.destination_name && <small>→ {t.destination_name}</small>}
              </td>
              <td data-label="Data">
                {formatDate(t.transaction_date)}
                {t.due_date && <small>Vence {formatDate(t.due_date)}</small>}
              </td>
              <td data-label="Situação">
                <span className={`status-badge status-${t.display_status}`}>
                  {t.source === "card" && t.status === "completed"
                    ? "Compra reconhecida"
                    : statuses[t.display_status]}
                </span>
              </td>
              <td data-label="Valor" className={`numeric amount-${t.type}`}>
                {t.type === "expense" ? "− " : t.type === "income" ? "+ " : ""}
                {money(t.amount)}
              </td>
              {editable && role !== "viewer" && (
                <td data-label="Ações">
                  {t.source === "card" ? (
                    <Link
                      className="text-link"
                      href={`/app/cartoes/${t.card_id}`}
                    >
                      Ver cartão
                    </Link>
                  ) : (
                    <div className="row-actions">
                      <FinanceDialog label="Editar" title="Editar lançamento">
                        <TransactionForm
                          profileId={profileId}
                          accounts={accounts}
                          categories={categories}
                          transaction={t}
                        />
                      </FinanceDialog>
                      <TransactionRemove
                        profileId={profileId}
                        transaction={t}
                        owner={role === "owner"}
                      />
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function TransactionFilters({
  filters,
  accounts,
  categories,
  path,
  fixedType,
}: {
  filters: Filters;
  accounts: Account[];
  categories: Category[];
  path: string;
  fixedType: string;
}) {
  return (
    <form method="get" action={path} className="panel filter-form">
      <label>
        De
        <input type="date" name="from" defaultValue={filters.from} required />
      </label>
      <label>
        Até
        <input type="date" name="to" defaultValue={filters.to} required />
      </label>
      <label>
        Conta
        <select name="account" defaultValue={filters.account}>
          <option value="">Todas as contas e cartões</option>
          {accounts.map((a) => (
            <option value={a.id} key={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Categoria
        <select name="category" defaultValue={filters.category}>
          <option value="">Todas as categorias</option>
          {categories
            .filter((c) => !fixedType || c.kind === fixedType)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.kind === "income" ? "Receita" : "Despesa"}
              </option>
            ))}
        </select>
      </label>
      <label>
        Situação
        <select name="status" defaultValue={filters.status}>
          <option value="">Todas</option>
          {Object.entries(statuses).map(([v, label]) => (
            <option value={v} key={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {!fixedType && (
        <label>
          Tipo
          <select name="type" defaultValue={filters.type}>
            <option value="">Todos</option>
            <option value="income">Receitas</option>
            <option value="expense">Despesas</option>
            <option value="transfer">Transferências</option>
          </select>
        </label>
      )}
      {fixedType === "expense" && (
        <label>
          Despesas
          <select name="kind" defaultValue={filters.kind}>
            <option value="">Todas</option>
            <option value="fixed">Fixas</option>
            <option value="variable">Variáveis</option>
          </select>
        </label>
      )}
      <label className="search-filter">
        Descrição
        <input
          type="search"
          name="search"
          defaultValue={filters.search}
          placeholder="Buscar lançamento…"
          maxLength={160}
        />
      </label>
      <div className="row-actions">
        <button className="button primary" type="submit">
          Filtrar
        </button>
        <Link className="button secondary" href={path}>
          Limpar
        </Link>
      </div>
    </form>
  );
}
export function filterHref(
  path: string,
  filters: Filters,
  updates: Partial<Filters> = {},
) {
  const f = { ...filters, ...updates };
  const params = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v !== "" && v !== undefined) params.set(k, String(v));
  });
  return path + "?" + params.toString();
}
export function Pagination({
  total,
  filters,
  path,
}: {
  total: number;
  filters: Filters;
  path: string;
}) {
  const pages = Math.ceil(total / 30);
  if (pages <= 1 && filters.page === 1) return null;
  return (
    <nav className="pagination" aria-label="Páginas de lançamentos">
      <span>
        {total} resultados · página {filters.page} de {Math.max(1, pages)}
      </span>
      <div className="row-actions">
        {filters.page > 1 && (
          <Link
            className="button secondary"
            href={filterHref(path, filters, { page: filters.page - 1 })}
          >
            Anterior
          </Link>
        )}
        {filters.page < pages && (
          <Link
            className="button secondary"
            href={filterHref(path, filters, { page: filters.page + 1 })}
          >
            Próxima
          </Link>
        )}
      </div>
    </nav>
  );
}
