"use client";
import { ActionForm, ConfirmAction } from "@/components/finance/forms";
import { addProfileMember, removeProfileMember, saveBusinessContact, saveBusinessReceivable } from "@/app/actions/business";
import { today } from "@/lib/finance";
import type { Account, Category } from "@/types/finance";
import type { BusinessContact } from "@/types/business";

export function ContactForm({ profileId, contact }: { profileId: string; contact?: BusinessContact }) {
  return <ActionForm action={saveBusinessContact} profileId={profileId} id={contact?.id} submit={contact ? "Atualizar contato" : "Adicionar contato"}>
    <label>Nome ou razão social<input name="name" required minLength={2} maxLength={120} defaultValue={contact?.name} /></label>
    <label>Relacionamento<select name="kind" defaultValue={contact?.kind ?? "client"}><option value="client">Cliente</option><option value="supplier">Fornecedor</option><option value="both">Cliente e fornecedor</option></select></label>
    <div className="form-grid"><label>CPF ou CNPJ<input name="document" maxLength={30} defaultValue={contact?.document} /></label><label>Telefone<input name="phone" maxLength={30} defaultValue={contact?.phone} /></label></div>
    <label>E-mail<input name="email" type="email" maxLength={254} defaultValue={contact?.email} /></label>
    <label>Observações<textarea name="notes" maxLength={2000} defaultValue={contact?.notes} /></label>
  </ActionForm>;
}
export function ReceivableForm({ profileId, contacts, accounts, categories }: { profileId: string; contacts: BusinessContact[]; accounts: Account[]; categories: Category[] }) {
  return <ActionForm action={saveBusinessReceivable} profileId={profileId} submit="Adicionar conta a receber">
    <label>Cliente<select name="contact_id" required defaultValue=""><option disabled value="">Selecione</option>{contacts.filter((c) => c.active && c.kind !== "supplier").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Descrição<input name="description" required minLength={2} maxLength={160} placeholder="Ex.: Projeto de consultoria" /></label>
    <div className="form-grid"><label>Valor<input name="amount" inputMode="decimal" required placeholder="2.500,00" /></label><label>Vencimento<input name="due_date" type="date" required defaultValue={today()} /></label></div>
    <input name="issue_date" type="hidden" value={today()} />
    <label>Conta de recebimento<select name="account_id" required defaultValue=""><option disabled value="">Selecione</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label>Categoria de receita<select name="category_id" required defaultValue=""><option disabled value="">Selecione</option>{categories.filter((c) => c.kind === "income").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Observações<textarea name="notes" maxLength={2000} /></label>
  </ActionForm>;
}
export function TeamForm({ profileId }: { profileId: string }) { return <ActionForm action={addProfileMember} profileId={profileId} submit="Conceder acesso"><label>E-mail da conta confirmada<input name="email" type="email" maxLength={254} required placeholder="contador@empresa.com" /></label><label>Nível de acesso<select name="role" defaultValue="viewer"><option value="viewer">Contador · somente leitura</option><option value="editor">Colaborador · leitura e edição</option></select></label><p className="field-hint">A pessoa precisa criar e confirmar uma conta no iSev Finance antes de receber acesso.</p></ActionForm>; }
export function RemoveTeamMember({ profileId, userId, name }: { profileId: string; userId: string; name: string }) { return <ConfirmAction profileId={profileId} id={userId} action={removeProfileMember} label="Remover" message={`Remover o acesso de ${name}?`}/>; }
