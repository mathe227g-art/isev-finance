import { z } from "zod";
import {
  positiveMoney,
  decimalSchema,
  dateSchema,
  today,
  shiftMonth,
} from "./finance.ts";
export const investmentTypes = {
  treasury: "Tesouro Direto",
  cdb: "CDB",
  lci: "LCI",
  lca: "LCA",
  savings: "Poupança",
  fund: "Fundo de investimento",
  stock: "Ações",
  reit: "FIIs",
  etf: "ETF",
  crypto: "Criptomoeda",
  pension: "Previdência",
  other: "Outro",
} as const;
export const itemTypes = {
  property: "Imóvel",
  vehicle: "Veículo",
  business: "Empresa",
  valuable: "Bem de valor",
  cash: "Dinheiro fora das contas",
  other: "Outro",
  financing: "Financiamento",
  loan: "Empréstimo",
  debt: "Dívida",
} as const;
export const movementTypes = {
  deposit: "Aporte",
  withdrawal: "Retirada",
  yield: "Rendimento reinvestido",
  dividend: "Provento reinvestido",
  valuation: "Atualizar valor total",
} as const;
export const positionLabels = {
  goal: "Metas",
  reserve: "Reserva de emergência",
  investment: "Investimentos",
} as const;
export const positionPaths = {
  goal: "/app/metas",
  reserve: "/app/reserva",
  investment: "/app/investimentos",
} as const;
export const invoiceStatuses = {
  open: "Aberta",
  closed: "Fechada",
  paid: "Paga",
  overdue: "Atrasada",
} as const;
const name = z.string().trim().min(2, "Informe um nome.").max(100),
  notes = z.string().trim().max(2000),
  nonnegative = decimalSchema.refine(
    (v) => BigInt(v.replace(".", "")) >= BigInt(0),
    "Use valor positivo ou zero.",
  );
const optionalMoney = z.union([z.literal(""), positiveMoney]);
const optionalDate = z.union([z.literal(""), dateSchema]);
export const cardSchema = z.object({
  name: name.max(80),
  institution: z.string().trim().max(100),
  brand: z.string().trim().max(40),
  last_four: z
    .string()
    .regex(/^(\d{4})?$/, "Informe somente os últimos 4 dígitos."),
  credit_limit: positiveMoney,
  closing_day: z.coerce.number().int().min(1).max(31),
  due_day: z.coerce.number().int().min(1).max(31),
  payment_account_id: z.uuid("Selecione uma conta."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  active: z.enum(["true", "false"]).transform((v) => v === "true"),
});
export const positionSchema = z
  .object({
    kind: z.enum(["goal", "reserve", "investment"]),
    name,
    description: notes,
    institution: z.string().trim().max(100),
    ticker: z.string().trim().max(30),
    investment_type: z.union([
      z.literal(""),
      z.enum(
        Object.keys(investmentTypes) as [
          keyof typeof investmentTypes,
          ...(keyof typeof investmentTypes)[],
        ],
      ),
    ]),
    target_amount: optionalMoney,
    target_date: optionalDate,
    essential_cost: optionalMoney,
    target_months: z.union([
      z.literal(""),
      z.coerce.number().int().min(1).max(120),
    ]),
    status: z.enum(["active", "completed", "archived"]),
  })
  .superRefine((v, c) => {
    if (
      (v.kind === "goal" && !v.target_amount) ||
      (v.kind === "reserve" && (!v.essential_cost || !v.target_months)) ||
      (v.kind === "investment" && !v.investment_type)
    )
      c.addIssue({
        code: "custom",
        message: "Preencha o objetivo ou a configuração deste módulo.",
      });
  });
export const itemSchema = z.object({
  name,
  kind: z.enum(["asset", "liability"]),
  category: z.enum(
    Object.keys(itemTypes) as [
      keyof typeof itemTypes,
      ...(keyof typeof itemTypes)[],
    ],
  ),
  amount: nonnegative,
  notes,
  active: z.enum(["true", "false"]).transform((v) => v === "true"),
});
export const purchaseSchema = z.object({
  card_id: z.uuid(),
  category_id: z.uuid(),
  description: z.string().trim().min(2).max(160),
  amount: positiveMoney,
  purchase_date: dateSchema.refine(
    (v) => v <= today(),
    "A compra não pode ter data futura.",
  ),
  installment_count: z.coerce.number().int().min(1).max(60),
  expense_kind: z.enum(["fixed", "variable"]),
  notes,
  request_id: z.uuid(),
});
export const movementSchema = z
  .object({
    position_id: z.uuid(),
    kind: z.enum(["deposit", "withdrawal", "yield", "dividend", "valuation"]),
    amount: nonnegative,
    account_id: z.union([z.literal(""), z.uuid()]),
    movement_date: dateSchema.refine(
      (v) => v <= today(),
      "A movimentação não pode ter data futura.",
    ),
    notes,
    request_id: z.uuid(),
  })
  .superRefine((v, c) => {
    if (
      (v.kind === "deposit" || v.kind === "withdrawal") !==
      Boolean(v.account_id)
    )
      c.addIssue({
        code: "custom",
        message:
          "Aporte/retirada exigem conta; rendimentos e ajustes não usam conta.",
      });
    if (
      v.kind !== "valuation" &&
      BigInt(v.amount.replace(".", "")) <= BigInt(0)
    )
      c.addIssue({ code: "custom", message: "Informe valor maior que zero." });
  });
export function currentBillingMonth(closingDay: number, date = today()) {
  const month = date.slice(0, 7);
  return Number(date.slice(8)) > closingDay ? shiftMonth(month, 1) : month;
}

export function cardTextColor(hex: string) {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? "#061d35" : "#ffffff";
}
