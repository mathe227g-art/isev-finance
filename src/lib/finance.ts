import { z } from "zod";
export const accountKinds = {
  checking: "Conta corrente",
  savings: "Conta poupança",
  digital: "Conta digital",
  wallet: "Carteira",
  cash: "Dinheiro",
  investment: "Investimento",
  other: "Outro",
} as const;
export const frequencies = {
  weekly: "Semanal",
  monthly: "Mensal",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
} as const;
export const statuses = {
  pending: "Pendente",
  completed: "Concluída",
  overdue: "Atrasada",
  cancelled: "Cancelada",
} as const;
export const icons = {
  tag: "Etiqueta",
  home: "Casa",
  utensils: "Alimentação",
  car: "Transporte",
  heart: "Saúde",
  book: "Educação",
  briefcase: "Trabalho",
  shopping: "Compras",
  wallet: "Dinheiro",
  receipt: "Contas",
} as const;
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
  .refine(
    (v) =>
      v >= "1900-01-01" &&
      v <= "2100-12-31" &&
      !Number.isNaN(Date.parse(v)) &&
      new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v,
    "Data inválida.",
  );
export function currentMonth() {
  return today().slice(0, 7);
}
export function monthRange(value?: string) {
  const month =
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? "") &&
    value! >= "1900-01" &&
    value! <= "2100-12"
      ? value!
      : currentMonth();
  const [year, m] = month.split("-").map(Number);
  return {
    month,
    from: month + "-01",
    to:
      month +
      "-" +
      new Date(Date.UTC(year, m, 0)).getUTCDate().toString().padStart(2, "0"),
  };
}
export function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}
export function formatDate(value: string) {
  return value.slice(0, 10).split("-").reverse().join("/");
}
export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(month + "-01T12:00:00Z"));
}
// Only rendering uses BigInt cents; all balances/aggregates are calculated in SQL NUMERIC.
export function money(value: string) {
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const grouped = BigInt(whole || "0").toLocaleString("pt-BR");
  return `${negative ? "- " : ""}R$ ${grouped},${fraction.padEnd(2, "0").slice(0, 2)}`;
}
export function moneyInput(value: string) {
  return value.replace(".", ",");
}
export function decimalInput(value: string) {
  let clean = value.trim();
  if (clean.includes(",")) clean = clean.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d{1,16}(\.\d{1,2})?$/.test(clean))
    throw new Error("Use um valor como 1.250,90, com até duas casas decimais.");
  const [whole, fraction = ""] = clean.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}
export const decimalSchema = z.string().transform((v, ctx) => {
  try {
    return decimalInput(v);
  } catch {
    ctx.addIssue({
      code: "custom",
      message: "Valor inválido. Use, por exemplo, 1.250,90.",
    });
    return z.NEVER;
  }
});
export const positiveMoney = decimalSchema.refine(
  (v) => BigInt(v.replace(".", "")) > BigInt(0),
  "O valor deve ser maior que zero.",
);
const name = z.string().trim().min(2, "Use pelo menos 2 caracteres.").max(80);
export const accountSchema = z.object({
  name,
  institution: z.string().trim().max(100),
  kind: z.enum([
    "checking",
    "savings",
    "digital",
    "wallet",
    "cash",
    "investment",
    "other",
  ]),
  opening_balance: decimalSchema,
  currency: z.literal("BRL"),
});
export const categorySchema = z.object({
  name,
  kind: z.enum(["income", "expense"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Escolha uma cor válida."),
  icon: z.enum([
    "tag",
    "home",
    "utensils",
    "car",
    "heart",
    "book",
    "briefcase",
    "shopping",
    "wallet",
    "receipt",
  ]),
});
const nullableId = z
  .union([z.uuid(), z.literal("")])
  .transform((v) => v || null);
const nullableDate = z
  .union([dateSchema, z.literal("")])
  .transform((v) => v || null);
const description = z.string().trim().min(2, "Informe uma descrição.").max(160);
export const transactionSchema = z
  .object({
    expense_kind: z.enum(["fixed", "variable"]).optional(),
    account_id: z.uuid("Selecione uma conta."),
    category_id: nullableId,
    destination_account_id: nullableId,
    type: z.enum(["income", "expense", "transfer"]),
    description,
    amount: positiveMoney,
    transaction_date: dateSchema,
    due_date: nullableDate,
    status: z.enum(["pending", "completed", "cancelled"]),
    notes: z.string().trim().max(2000),
  })
  .superRefine((v, ctx) => {
    if (
      v.type === "transfer" &&
      (!v.destination_account_id ||
        v.destination_account_id === v.account_id ||
        v.category_id)
    )
      ctx.addIssue({
        code: "custom",
        message: "Escolha duas contas diferentes e deixe a categoria vazia.",
      });
    if (v.type !== "transfer" && (!v.category_id || v.destination_account_id))
      ctx.addIssue({
        code: "custom",
        message: "Selecione uma categoria e somente uma conta.",
      });
    if (v.status === "completed" && v.transaction_date > today())
      ctx.addIssue({
        code: "custom",
        message: "Um lançamento futuro deve permanecer pendente.",
      });
  });
export const recurrenceSchema = z
  .object({
    expense_kind: z.enum(["fixed", "variable"]).optional(),
    account_id: z.uuid(),
    category_id: z.uuid(),
    type: z.enum(["income", "expense"]),
    description,
    amount: positiveMoney,
    frequency: z.enum([
      "weekly",
      "monthly",
      "bimonthly",
      "quarterly",
      "semiannual",
      "annual",
    ]),
    due_day: z.coerce.number().int().min(1).max(31),
    start_date: dateSchema,
    end_date: nullableDate,
    notes: z.string().trim().max(2000),
  })
  .refine((v) => !v.end_date || v.end_date >= v.start_date, {
    message: "A data final deve ser posterior à inicial.",
  });
