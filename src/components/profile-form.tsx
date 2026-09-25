"use client";
import { useActionState } from "react";
import { UserRound, Building2, Shapes } from "lucide-react";
import { createProfile } from "@/app/actions/financial-profiles";
import { SubmitButton } from "./submit-button";
export function ProfileForm() {
  const [state, action] = useActionState(createProfile, {});
  return (
    <form action={action} className="form-stack">
      <fieldset className="profile-options">
        <legend>Como você deseja começar?</legend>
        {[
          {
            value: "CPF",
            title: "Pessoa física",
            hint: "Sua vida pessoal",
            Icon: UserRound,
          },
          {
            value: "CNPJ",
            title: "Empresa",
            hint: "Seu negócio",
            Icon: Building2,
          },
          {
            value: "OTHER",
            title: "Outro",
            hint: "Família ou projeto",
            Icon: Shapes,
          },
        ].map(({ value, title, hint, Icon }) => (
          <label key={value}>
            <input
              type="radio"
              name="kind"
              value={value}
              defaultChecked={value === "CPF"}
              required
            />
            <span>
              <Icon size={25} />
              <strong>{title}</strong>
              <small>{hint}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <label>
        Nome do perfil financeiro
        <input
          name="name"
          placeholder="Ex.: Finanças pessoais ou Minha empresa"
          required
          minLength={2}
          maxLength={80}
        />
      </label>
      <p className="field-hint">
        Não é necessário informar seu número de CPF ou CNPJ.
      </p>
      {state.error && (
        <p role="alert" className="feedback error">
          {state.error}
        </p>
      )}
      <SubmitButton pendingLabel="Criando perfil…">
        Criar perfil financeiro
      </SubmitButton>
    </form>
  );
}
