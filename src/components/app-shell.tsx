"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  UsersRound,
  Plus,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  ArrowLeftRight,
  WalletCards,
  ChartNoAxesCombined,
  Target,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Tags,
  Repeat2,
  Upload,
  FileText,
  Settings2,
  BadgeDollarSign,
  Building2,
  UserRoundCog,
} from "lucide-react";
import { Brand } from "./brand";
import { ProfileSelector } from "./profile-selector";
import { logout } from "@/app/actions/auth";
import type { FinancialProfile } from "@/types/database";
import { PwaInstallButton } from "./pwa-install-button";
export function AppShell({
  profiles,
  active,
  userName,
  children,
}: {
  profiles: FinancialProfile[];
  active: FinancialProfile | null;
  userName: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const sidebar = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebar.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
      if (event.key === "Tab") {
        const elements = Array.from(
          sidebar.current?.querySelectorAll<HTMLElement>("a,button,select") ??
            [],
        ).filter(
          (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
        );
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Pular para o conteúdo
      </a>
      {open && (
        <button
          className="scrim"
          aria-label="Fechar menu"
          onClick={() => {
            setOpen(false);
            toggle.current?.focus();
          }}
        />
      )}
      <aside
        ref={sidebar}
        id="sidebar"
        className={`sidebar ${open ? "open" : ""}`}
      >
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-only"
            aria-label="Fechar menu"
            onClick={() => {
              setOpen(false);
              toggle.current?.focus();
            }}
          >
            <X />
          </button>
        </div>
        <ProfileSelector profiles={profiles} activeId={active?.id} />
        <Link
          className="new-profile"
          href="/app/perfis/novo"
          onClick={() => setOpen(false)}
        >
          <Plus size={16} /> Novo perfil financeiro
        </Link>
        <nav aria-label="Navegação principal">
          <span className="nav-label">PRINCIPAL</span>
          <Link
            className={path === "/app" ? "nav-item active" : "nav-item"}
            href="/app"
            onClick={() => setOpen(false)}
          >
            <LayoutDashboard size={19} /> Visão geral
          </Link>
          <Link
            className={
              path.startsWith("/app/perfis") ? "nav-item active" : "nav-item"
            }
            href="/app/perfis"
            onClick={() => setOpen(false)}
          >
            <UsersRound size={19} /> Perfis financeiros
          </Link>
          <span className="nav-label">FINANÇAS</span>
          <Link
            href="/app/orcamento"
            className={
              path === "/app/orcamento" ? "nav-item active" : "nav-item"
            }
            onClick={() => setOpen(false)}
          >
            <ChartNoAxesCombined size={19} />
            Orçamento
          </Link>
          {[
            {
              label: "Transações",
              href: "/app/transacoes",
              Icon: ArrowLeftRight,
            },
            { label: "Receitas", href: "/app/receitas", Icon: ArrowUpRight },
            { label: "Despesas", href: "/app/despesas", Icon: ArrowDownLeft },
            { label: "Contas", href: "/app/contas", Icon: Wallet },
            { label: "Categorias", href: "/app/categorias", Icon: Tags },
            { label: "Recorrências", href: "/app/recorrencias", Icon: Repeat2 },
          ].map(({ label, href, Icon }) => (
            <Link
              key={href}
              className={path === href ? "nav-item active" : "nav-item"}
              href={href}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
          <span className="nav-label">PLANEJAMENTO</span>
          {[
            { label: "Cartões", href: "/app/cartoes", Icon: WalletCards },
            {
              label: "Investimentos",
              href: "/app/investimentos",
              Icon: ChartNoAxesCombined,
            },
            { label: "Metas", href: "/app/metas", Icon: Target },
            {
              label: "Reserva de emergência",
              href: "/app/reserva",
              Icon: ShieldCheck,
            },
            { label: "Patrimônio", href: "/app/patrimonio", Icon: Wallet },
          ].map(({ label, href, Icon }) => (
            <Link
              key={href}
              href={href}
              className={path.startsWith(href) ? "nav-item active" : "nav-item"}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
          <span className="nav-label">FERRAMENTAS</span>
          {active?.kind === "CNPJ" && [
            { label: "Clientes e fornecedores", href: "/app/negocios", Icon: Building2 },
            { label: "Equipe e contador", href: "/app/equipe", Icon: UserRoundCog },
          ].map(({ label, href, Icon }) => (
            <Link key={href} href={href} className={path === href ? "nav-item active" : "nav-item"} onClick={() => setOpen(false)}>
              <Icon size={19} />{label}
            </Link>
          ))}
          {[
            { label: "Assinaturas", href: "/app/assinaturas", Icon: BadgeDollarSign },
            { label: "Importar extrato", href: "/app/importar", Icon: Upload },
            { label: "Relatório mensal", href: "/app/relatorio", Icon: FileText },
            { label: "Personalizar painel", href: "/app/painel", Icon: Settings2 },
          ].map(({ label, href, Icon }) => (
            <Link key={href} href={href} className={path === href ? "nav-item active" : "nav-item"} onClick={() => setOpen(false)}>
              <Icon size={19} />{label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <PwaInstallButton />
          <div className="secure-note">
            <ShieldCheck size={19} />
            <p>
              Um espaço para cada perfil.
              <small>Acesso protegido à sua conta.</small>
            </p>
          </div>
          <div className="user-row">
            <div className="avatar">{userName.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{userName}</strong>
              <small>Minha conta</small>
            </div>
            <form action={logout}>
              <button
                title="Sair da conta"
                aria-label="Sair da conta"
                className="icon-button"
              >
                <LogOut size={19} />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="main-shell" inert={open ? true : undefined}>
        <header className="topbar">
          <div className="topbar-title">
            <button
              ref={toggle}
              className="icon-button mobile-only"
              aria-label="Abrir menu"
              aria-expanded={open}
              aria-controls="sidebar"
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            <span>
              Meu espaço <span className="breadcrumb">/</span>{" "}
              <strong>
                {path.startsWith("/app/perfis")
                  ? "Perfis financeiros"
                  : ((
                      {
                        "/app/cartoes": "Cartões",
                        "/app/metas": "Metas",
                        "/app/reserva": "Reserva de emergência",
                        "/app/investimentos": "Investimentos",
                        "/app/patrimonio": "Patrimônio",
                        "/app/posicoes": "Histórico de movimentações",
                        "/app/transacoes": "Transações",
                        "/app/orcamento": "Orçamento",
                        "/app/pendencias": "Contas a pagar e receber",
                        "/app/receitas": "Receitas",
                        "/app/despesas": "Despesas",
                        "/app/contas": "Contas",
                        "/app/categorias": "Categorias",
                        "/app/recorrencias": "Recorrências",
                        "/app/assinaturas": "Assinaturas",
                        "/app/importar": "Importar extrato",
                        "/app/relatorio": "Relatório mensal",
                        "/app/painel": "Personalizar painel",
                        "/app/negocios": "Clientes e fornecedores",
                        "/app/equipe": "Equipe e contador",
                      } as Record<string, string>
                    )[
                      path.startsWith("/app/cartoes/")
                        ? "/app/cartoes"
                        : path.startsWith("/app/posicoes/")
                          ? "/app/posicoes"
                          : path
                    ] ?? "Visão geral")}
              </strong>
            </span>
          </div>
          <span className="topbar-tag">Seu dinheiro. Seu futuro.</span>
        </header>
        <main id="main" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          iSev Finance <span>Feito para olhar à frente.</span>
        </footer>
      </div>
    </div>
  );
}
