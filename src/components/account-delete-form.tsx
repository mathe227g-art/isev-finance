"use client";

import { useActionState } from "react";
import { deleteOwnAccount } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";

export function AccountDeleteForm() {
  const [state, action] = useActionState(deleteOwnAccount, {});
  return (
    <form action={action} className="form-stack">
      <p>
        Todos os perfis financeiros, lançamentos, cartões, investimentos, metas
        e preferências vinculados à sua conta serão excluídos. Esta ação não
        pode ser desfeita.
      </p>
      <label className="confirmation-check">
        <input type="checkbox" name="confirmed" value="yes" required />
        Li e confirmo a exclusão permanente da minha conta.
      </label>
      {state.error && (
        <p className="feedback error" role="alert">
          {state.error}
        </p>
      )}
      <SubmitButton pendingLabel="Excluindo conta…">
        Excluir minha conta permanentemente
      </SubmitButton>
    </form>
  );
}
