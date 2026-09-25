import Link from "next/link";
export default function NotFound() {
  return (
    <div className="standalone-message">
      <h1>Página não encontrada.</h1>
      <p>Este endereço não está disponível.</p>
      <Link className="button primary" href="/app">
        Voltar ao início
      </Link>
    </div>
  );
}
