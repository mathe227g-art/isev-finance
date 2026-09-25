import { z } from "zod";
import { positiveMoney, dateSchema, money } from "./finance.ts";
import type { Insights, BudgetCategory } from "../types/insights";
export const budgetSchema = z.object({
  category_id: z.uuid("Selecione uma categoria."),
  month: dateSchema.refine((v) => v.endsWith("-01"), "Mês inválido."),
  amount: positiveMoney,
});
export const windows = {
  "7d": "Últimos 7 dias",
  month: "Este mês",
  "3m": "Últimos 3 meses",
  "6m": "Últimos 6 meses",
  year: "Este ano",
} as const;
export function validWindow(value?: string): keyof typeof windows {
  return value && Object.hasOwn(windows, value)
    ? (value as keyof typeof windows)
    : "month";
}
export const budgetStates: Record<BudgetCategory["state"], string> = {
  normal: "Dentro do orçamento",
  near: "Próximo do limite",
  reached: "Limite atingido",
  exceeded: "Orçamento ultrapassado",
  unplanned: "Sem orçamento",
};
export function percent(value: string | null) {
  return value === null ? "—" : value.replace(".", ",") + "%";
}
export function cents(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return (
    BigInt(whole) * BigInt(100) +
    (value.startsWith("-") ? BigInt(-1) : BigInt(1)) *
      BigInt(fraction.padEnd(2, "0").slice(0, 2))
  );
}
export function financialAlerts(data: Insights) {
  const alerts: {
    level: "informação" | "atenção" | "crítico";
    text: string;
  }[] = [];
  for (const c of data.budget.categories) {
    if (c.state === "exceeded")
      alerts.push({
        level: "crítico",
        text: `Você ultrapassou o orçamento de ${c.name} em ${money(c.remaining.replace("-", ""))}.`,
      });
    else if (c.state === "near" || c.state === "reached")
      alerts.push({
        level: "atenção",
        text: `Seu orçamento de ${c.name} está em ${percent(c.percentage)}.`,
      });
  }
  if (cents(data.overdue) > BigInt(0))
    alerts.push({
      level: "crítico",
      text: `Você possui ${money(data.overdue)} em despesas atrasadas.`,
    });
  if (cents(data.due_week) > BigInt(0))
    alerts.push({
      level: "informação",
      text: `Você possui ${money(data.due_week)} em contas a vencer hoje e nos próximos 6 dias.`,
    });
  if (cents(data.expense) > cents(data.income))
    alerts.push({
      level: "atenção",
      text: "Suas despesas pagas no mês selecionado estão maiores que suas receitas recebidas.",
    });
  return alerts;
}
