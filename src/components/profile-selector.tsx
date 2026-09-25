"use client";
import { useActionState } from "react";
import { switchProfile } from "@/app/actions/financial-profiles";
import type { FinancialProfile } from "@/types/database";
export function ProfileSelector({
  profiles,
  activeId,
}: {
  profiles: FinancialProfile[];
  activeId?: string;
}) {
  const [state, action, pending] = useActionState(switchProfile, {});
  return (
    <form action={action} className="profile-select">
      <label htmlFor="active-profile">PERFIL FINANCEIRO</label>
      <select
        id="active-profile"
        name="financial_profile_id"
        value={activeId ?? ""}
        disabled={pending || !profiles.length}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {!profiles.length && <option value="">Crie seu primeiro perfil</option>}
        {profiles.map((p) => (
          <option value={p.id} key={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {pending && <small role="status">Alternando perfil…</small>}
      {state.error && (
        <p role="alert" className="selector-error">
          {state.error}
        </p>
      )}
    </form>
  );
}
