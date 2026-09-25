import { ProfileForm } from "@/components/profile-form";
import { getProfileContext } from "@/services/financial-profiles";
import Link from "next/link";
export default async function NewProfile() {
  const { profiles } = await getProfileContext();
  return (
    <div className="onboarding">
      <span className="eyebrow blue">
        {profiles.length ? "UM NOVO CONTEXTO" : "PRIMEIRO PASSO"}
      </span>
      <h1>
        {profiles.length
          ? "Crie um novo perfil."
          : "Vamos organizar seu espaço."}
      </h1>
      <p className="muted">
        Separe suas finanças por contexto. Você pode criar outros perfis depois.
      </p>
      <section className="panel onboarding-panel">
        <ProfileForm />
      </section>
      {profiles.length > 0 && (
        <Link className="text-link" href="/app/perfis">
          Voltar para meus perfis
        </Link>
      )}
    </div>
  );
}
