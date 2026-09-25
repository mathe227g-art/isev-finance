"use client";
import Link from "next/link";
export default function ErrorPage({
  retry,
  error,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="standalone-message">
      <h1>Não conseguimos carregar seu espaço.</h1>
      <p>
        Tente novamente em instantes. Se o problema continuar, entre em contato com o responsável pelo sistema.
      </p>
      {error.digest && <p>Referência para suporte: {error.digest}</p>}
      <button onClick={retry} className="button primary">
        Tentar novamente
      </button>
      <Link href="/login">Voltar para o login</Link>
    </div>
  );
}
