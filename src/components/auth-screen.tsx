import { ShieldCheck, Layers3, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Brand } from "./brand";
import { AuthForm, type AuthMode } from "./auth-form";
import { PwaInstallButton } from "./pwa-install-button";
const copy = {
  login: {
    title: "Bom ter você de volta.",
    description: "Acesse sua conta e cuide do seu próximo passo.",
  },
  signup: {
    title: "Seu futuro começa aqui.",
    description: "Crie sua conta e organize seus perfis financeiros.",
  },
  recover: {
    title: "Vamos recuperar seu acesso.",
    description: "Informe seu e-mail para receber um link de recuperação.",
  },
  password: {
    title: "Uma nova senha. Um novo acesso.",
    description: "Escolha uma senha segura para proteger sua conta.",
  },
};
export function AuthScreen({
  mode,
  notice,
}: {
  mode: AuthMode;
  notice?: string;
}) {
  return (
    <div className="auth-page">
      <section className="auth-story">
        <Brand />
        <div className="story-content">
          <span className="eyebrow">SEU DINHEIRO. SEU FUTURO.</span>
          <h1>
            Clareza para hoje.
            <br />
            <span>
              Liberdade para
              <br />o amanhã.
            </span>
          </h1>
          <p>
            Sua vida pessoal e seus negócios.
            <br />
            Cada um no seu espaço, todos na sua visão.
          </p>
          <div className="story-profiles">
            <div>
              <span className="story-icon">
                <Layers3 size={22} />
              </span>
              <div>
                <strong>Uma conta. Vários contextos.</strong>
                <p>Pessoal, empresa ou um novo projeto.</p>
              </div>
              <ArrowUpRight size={22} />
            </div>
          </div>
        </div>
        <div className="story-footer">
          <ShieldCheck size={17} /> Seu espaço financeiro, com acesso protegido.
        </div>
      </section>
      <section className="auth-panel">
        <div className="mobile-brand">
          <Brand />
        </div>
        <div className="auth-card">
          <span className="eyebrow blue">BEM-VINDO AO ISEV FINANCE</span>
          <h2>{copy[mode].title}</h2>
          <p className="muted intro">{copy[mode].description}</p>
          {notice && (
            <p role="status" className="feedback neutral">
              {notice}
            </p>
          )}
          <AuthForm mode={mode} />
          <div className="auth-install">
            <PwaInstallButton />
          </div>
        </div>
        <footer>
          <span>iSev Finance · Organização em cada escolha.</span>
          <nav aria-label="Documentos legais">
            <Link href="/privacidade">Privacidade</Link>
            <Link href="/termos">Termos</Link>
          </nav>
        </footer>
      </section>
    </div>
  );
}
