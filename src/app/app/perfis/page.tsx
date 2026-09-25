import Link from "next/link";
import { Plus, Layers3 } from "lucide-react";
import { getProfileContext } from "@/services/financial-profiles";
export default async function Profiles() {
  const { profiles, active } = await getProfileContext();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow blue">SUA ORGANIZAÇÃO</span>
          <h1>Perfis financeiros</h1>
          <p>Um espaço independente para cada parte da sua vida.</p>
        </div>
        <Link href="/app/perfis/novo" className="button primary">
          <Plus size={18} /> Novo perfil
        </Link>
      </div>
      {profiles.length ? (
        <>
          <p className="muted">
            Use o seletor no menu para alternar entre seus perfis.
          </p>
          <div className="profiles-grid">
            {profiles.map((p) => (
              <article key={p.id} className="panel profile-card">
                <div className="section-heading">
                  <span className="empty-icon">
                    <Layers3 size={23} />
                  </span>
                  {p.id === active?.id && (
                    <span className="phase-tag">Selecionado</span>
                  )}
                </div>
                <h2>{p.name}</h2>
                <p className="muted">
                  {p.kind === "OTHER"
                    ? "Outro"
                    : p.kind === "CPF"
                      ? "Pessoa física · CPF"
                      : "Empresa · CNPJ"}
                </p>
                <small>
                  Criado em{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  }).format(new Date(p.created_at))}
                </small>
              </article>
            ))}
          </div>
        </>
      ) : (
        <section className="panel empty-chart">
          <h2>Você ainda não tem perfis financeiros.</h2>
          <p>Crie seu primeiro perfil para começar.</p>
          <Link href="/app/perfis/novo" className="button primary">
            Criar primeiro perfil
          </Link>
        </section>
      )}
    </>
  );
}
