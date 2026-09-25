import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Brand } from "@/components/brand";

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <Brand />
      <div className="offline-card">
        <span className="offline-icon">
          <WifiOff size={28} />
        </span>
        <p className="eyebrow blue">SEM CONEXÃO</p>
        <h1>Você está offline.</h1>
        <p>
          Por segurança, seus dados financeiros não ficam salvos no cache do
          dispositivo. Reconecte-se para acessar o seu espaço.
        </p>
        <Link className="button primary" href="/app">
          Tentar novamente
        </Link>
      </div>
    </main>
  );
}
