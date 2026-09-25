"use client";
import { ActionForm } from "./forms";
import { saveBudget } from "@/app/actions/budgets";
import { moneyInput, monthLabel } from "@/lib/finance";
import type { Category } from "@/types/finance";
import type { BudgetCategory } from "@/types/insights";
export function BudgetForm({
  profileId,
  month,
  categories,
  budget,
  categoryId,
}: {
  profileId: string;
  month: string;
  categories: Category[];
  budget?: BudgetCategory;
  categoryId?: string;
}) {
  return (
    <ActionForm
      action={saveBudget}
      profileId={profileId}
      id={budget?.id ?? undefined}
    >
      <p className="muted">{monthLabel(month)} · Categoria de despesa</p>
      <input type="hidden" name="month" value={month + "-01"} />
      {budget?.id ? (
        <>
          <input type="hidden" name="category_id" value={budget.category_id} />
          <strong>{budget.name}</strong>
        </>
      ) : (
        <label>
          Categoria
          <select name="category_id" required defaultValue={categoryId ?? ""}>
            <option value="" disabled>
              Selecione uma categoria
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
      )}
      <label>
        Limite mensal (R$)
        <input
          name="amount"
          inputMode="decimal"
          required
          placeholder="Ex.: 800,00"
          defaultValue={budget?.id ? moneyInput(budget.planned) : ""}
        />
      </label>
      <p className="field-hint">
        O orçamento não movimenta dinheiro. O realizado acompanha despesas
        pagas em conta e compras no cartão, pela data do lançamento.
      </p>
    </ActionForm>
  );
}
