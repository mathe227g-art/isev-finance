import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseOfx } from "../src/lib/imports.ts";
test("CSV import accepts Brazilian values, quotes and explicit types",()=>{
  const rows=parseCsv('Data;Descrição;Valor;Tipo\n22/09/2026;"Salário, mensal";2.500,50;Receita\n23/09/2026;Mercado;-120,35;');
  assert.deepEqual(rows,[{date:"2026-09-22",description:"Salário, mensal",amount:"2500.50",type:"income"},{date:"2026-09-23",description:"Mercado",amount:"120.35",type:"expense"}]);
});
test("OFX import reads posted date, memo and signed amount",()=>{
  const rows=parseOfx('<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260922120000<TRNAMT>-19.90<MEMO>Café</STMTTRN><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260923<TRNAMT>100.00<NAME>Reembolso</STMTTRN></BANKTRANLIST></OFX>');
  assert.equal(rows.length,2);assert.equal(rows[0].type,"expense");assert.equal(rows[1].type,"income");
});
test("import rejects unknown columns and batches above the limit",()=>{
  assert.throws(()=>parseCsv("A;B\n1;2"),/colunas Data/);
  const lines=["Data;Descrição;Valor",...Array.from({length:501},(_,i)=>`22/09/2026;Linha ${i};1,00`)];
  assert.throws(()=>parseCsv(lines.join("\n")),/500/);
});
