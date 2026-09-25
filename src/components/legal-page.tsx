import Link from "next/link";
import { Brand } from "@/components/brand";

export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <main className="legal-shell">
      <header className="legal-header">
        <Link href="/login" aria-label="Voltar ao login do iSev Finance">
          <Brand />
        </Link>
        <Link className="button secondary" href="/login">
          Entrar
        </Link>
      </header>
      <article className="legal-document">
        <p className="eyebrow">ISEV FINANCE</p>
        <h1>{title}</h1>
        <p className="legal-updated">Última atualização: {updatedAt}</p>
        <div className="legal-content">{children}</div>
      </article>
      <footer className="legal-footer">
        <span>© 2026 iSev Finance</span>
        <nav aria-label="Documentos legais">
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/termos">Termos de uso</Link>
        </nav>
      </footer>
    </main>
  );
}
