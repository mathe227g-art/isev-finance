import Link from "next/link";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  ChartNoAxesCombined,
  CalendarDays,
  Layers3,
  ShieldCheck,
  Plus,
} from "lucide-react";
import type { FinancialProfile } from "@/types/database";
export function Dashboard({
  active,
  userName,
  profileCount,
  created,
}: {
  active: FinancialProfile;
  userName: string;
  profileCount: number;
  created: boolean;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow blue">CADA ESCOLHA CONTA</span>
          <h1>
            Olá, {userName.split(" ")[0]}{" "}
            <span className="greeting-dot">.</span>
          </h1>
          <p>
            Um novo olhar para as finanças de <strong>{active.name}</strong>.
          </p>
        </div>
        <div className="period">
          <CalendarDays size={18} />
          {new Intl.DateTimeFormat("pt-BR", {
            month: "long",
            year: "numeric",
            timeZone: "America/Sao_Paulo",
          }).format(new Date())}
        </div>
      </div>
      {created && (
        <p className="feedback success" role="status">
          Perfil criado com sucesso. Este é o seu novo espaço financeiro.
        </p>
      )}
      <section className="welcome-banner">
        <div>
          <span className="eyebrow">TUDO COMEÇA COM ORGANIZAÇÃO</span>
          <h2>
            Seu espaço está pronto.
            <br />
            Seu próximo capítulo também.
          </h2>
          <p>
            Perfil criado, acesso protegido e uma visão
            <br className="desktop-break" /> só para o que faz parte deste
            contexto.
          </p>
          <Link className="button light" href="/app/perfis">
            Ver meus perfis <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="profile-pass">
          <div className="pass-top">
            <Layers3 size={25} />
            <span>PERFIL ATIVO</span>
          </div>
          <strong>{active.name}</strong>
          <span>
            {active.kind === "CPF"
              ? "Pessoa física"
              : active.kind === "CNPJ"
                ? "Empresa"
                : "Outro contexto"}
          </span>
          <div className="pass-bottom">
            <ShieldCheck size={16} /> Seu contexto financeiro
          </div>
        </div>
      </section>
      <section className="overview-section">
        <div className="section-heading">
          <h2>Visão do seu mês</h2>
          <span className="phase-tag">Estrutura inicial</span>
        </div>
        <div className="metric-grid">
          {[
            { title: "Saldo atual", Icon: Wallet, color: "blue" },
            { title: "Receitas do mês", Icon: ArrowUpRight, color: "green" },
            { title: "Despesas do mês", Icon: ArrowDownLeft, color: "red" },
            {
              title: "Resultado do mês",
              Icon: ChartNoAxesCombined,
              color: "blue",
            },
          ].map(({ title, Icon, color }) => (
            <article className="metric-card" key={title}>
              <div>
                <span>{title}</span>
                <span className={`metric-icon ${color}`}>
                  <Icon size={19} />
                </span>
              </div>
              <strong aria-label="Ainda indisponível">—</strong>
              <p>Disponível com os lançamentos</p>
            </article>
          ))}
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="panel activity-panel">
          <div className="section-heading">
            <h2>Movimentação financeira</h2>
            <span className="muted">Receitas e despesas</span>
          </div>
          <div className="empty-chart">
            <span className="empty-icon">
              <ChartNoAxesCombined size={29} />
            </span>
            <h3>Sua história financeira começa aqui</h3>
            <p>
              Quando o módulo de transações estiver disponível,
              <br />
              você poderá acompanhar a evolução deste perfil.
            </p>
            <span className="subtle-tag">Disponível em uma próxima etapa</span>
          </div>
        </section>
        <section className="panel context-panel">
          <span className="eyebrow blue">CADA CONTEXTO, UM ESPAÇO</span>
          <h2>
            Seus perfis,
            <br />
            sua organização.
          </h2>
          <p>Separe suas finanças pessoais dos negócios e projetos.</p>
          <div className="profile-count">
            <strong>{profileCount.toString().padStart(2, "0")}</strong>
            <span>
              {profileCount === 1 ? "perfil financeiro" : "perfis financeiros"}
            </span>
          </div>
          <Link className="text-link" href="/app/perfis/novo">
            <Plus size={17} /> Criar outro perfil
          </Link>
        </section>
      </div>
      <div className="dashboard-note">
        <ShieldCheck size={17} />
        <span>
          Você está visualizando <strong>{active.name}</strong>. Troque de
          perfil pelo menu para mudar de contexto.
        </span>
      </div>
    </>
  );
}
