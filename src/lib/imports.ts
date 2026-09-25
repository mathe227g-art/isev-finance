import type { ImportRow } from "@/types/customer";

function cells(line: string, separator: string) {
  const result: string[] = [];
  let value = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === separator && !quoted) { result.push(value.trim()); value = ""; }
    else value += char;
  }
  result.push(value.trim());
  return result;
}
function normalizeDate(value: string) {
  const clean = value.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const match = clean.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}
function normalizeAmount(value: string) {
  let clean = value.trim().replace(/R\$|\s/g, "");
  const negative = clean.startsWith("-");
  clean = clean.replace(/^[+-]/, "");
  if (clean.includes(",")) clean = clean.replace(/\./g, "").replace(",", ".");
  if (!/^\d{1,16}(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, fraction = ""] = clean.split(".");
  return { amount: `${whole}.${fraction.padEnd(2, "0")}`, negative };
}
function transaction(date: string, description: string, rawAmount: string, explicitType = "") {
  const amount = normalizeAmount(rawAmount), normalizedDate = normalizeDate(date);
  if (!amount || !normalizedDate || description.trim().length < 2) return null;
  const type = /^(income|receita|credito|crédito)$/i.test(explicitType)
    ? "income" : /^(expense|despesa|debito|débito)$/i.test(explicitType)
      ? "expense" : amount.negative ? "expense" : "income";
  return { date: normalizedDate, description: description.trim().slice(0, 160), amount: amount.amount, type } satisfies ImportRow;
}
export function parseCsv(text: string): ImportRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("O CSV precisa ter cabeçalho e pelo menos uma linha.");
  const separator = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = cells(lines[0], separator).map((h) => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
  const index = (...names: string[]) => headers.findIndex((h) => names.includes(h));
  const date = index("data", "date"), description = index("descricao", "description", "historico", "memo"), amount = index("valor", "amount"), type = index("tipo", "type");
  if ([date, description, amount].some((i) => i < 0)) throw new Error("Use as colunas Data, Descrição e Valor. Tipo é opcional.");
  const rows = lines.slice(1).map((line) => { const row = cells(line, separator); return transaction(row[date] ?? "", row[description] ?? "", row[amount] ?? "", type >= 0 ? row[type] : ""); }).filter((row): row is ImportRow => Boolean(row));
  if (!rows.length) throw new Error("Nenhuma linha válida foi encontrada.");
  if (rows.length > 500) throw new Error("Importe no máximo 500 lançamentos por arquivo.");
  return rows;
}
function ofxField(block: string, name: string) {
  return block.match(new RegExp(`<${name}>([^<\\r\\n]+)`, "i"))?.[1]?.trim() ?? "";
}
export function parseOfx(text: string): ImportRow[] {
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi) ?? [];
  const rows = blocks.map((block) => {
    const rawDate = ofxField(block, "DTPOSTED").slice(0, 8);
    const date = rawDate.length === 8 ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : "";
    const ofxType=ofxField(block,"TRNTYPE").toUpperCase();
    const explicit=["CREDIT","DEP","DIRECTDEP","INT"].includes(ofxType)?"income":["DEBIT","CHECK","PAYMENT","FEE","ATM","POS"].includes(ofxType)?"expense":"";
    return transaction(date, ofxField(block, "MEMO") || ofxField(block, "NAME"), ofxField(block, "TRNAMT"), explicit);
  }).filter((row): row is ImportRow => Boolean(row));
  if (!rows.length) throw new Error("Nenhum lançamento válido foi encontrado no OFX.");
  if (rows.length > 500) throw new Error("Importe no máximo 500 lançamentos por arquivo.");
  return rows;
}
