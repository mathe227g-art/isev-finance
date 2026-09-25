import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Tag,
  Home,
  Utensils,
  Car,
  Heart,
  BookOpen,
  BriefcaseBusiness,
  ShoppingBag,
  Wallet,
  Receipt,
} from "lucide-react";
import { monthLabel, shiftMonth, money } from "@/lib/finance";
export function PhaseTwoNotice() {
  return (
    <section className="panel empty-chart">
      <h2>O núcleo financeiro ainda não está disponível.</h2>
      <p>
        Na primeira ativação, aplique manualmente a migration da Fase 2. Se ela
        já foi aplicada, confira a conexão e tente novamente.
      </p>
      <Link className="button secondary" href="/app/perfis">
        Meus perfis financeiros
      </Link>
    </section>
  );
}
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow blue">SEU CONTEXTO FINANCEIRO</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="panel empty-chart">
      <span className="empty-icon">
        <Wallet size={27} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </section>
  );
}
export function PeriodNav({
  month,
  path = "/app",
}: {
  month: string;
  path?: string;
}) {
  return (
    <nav className="period-nav" aria-label="Selecionar mês">
      <Link
        aria-label="Mês anterior"
        className="icon-button"
        href={`${path}?month=${shiftMonth(month, -1)}`}
      >
        <ChevronLeft size={18} />
      </Link>
      <span>{monthLabel(month)}</span>
      <Link
        aria-label="Próximo mês"
        className="icon-button"
        href={`${path}?month=${shiftMonth(month, 1)}`}
      >
        <ChevronRight size={18} />
      </Link>
    </nav>
  );
}
export function Metric({
  title,
  value,
  hint,
  tone = "",
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <div>{title}</div>
      <strong className="money-value">{money(value)}</strong>
      {hint && <p>{hint}</p>}
    </article>
  );
}
const iconMap = {
  tag: Tag,
  home: Home,
  utensils: Utensils,
  car: Car,
  heart: Heart,
  book: BookOpen,
  briefcase: BriefcaseBusiness,
  shopping: ShoppingBag,
  wallet: Wallet,
  receipt: Receipt,
};
export function CategoryIcon({ name, color }: { name: string; color: string }) {
  const Icon = iconMap[name as keyof typeof iconMap] ?? Tag;
  return (
    <span
      className="category-icon"
      style={{ color, backgroundColor: color + "14" }}
    >
      <Icon size={21} />
    </span>
  );
}
export function ReadOnly() {
  return (
    <p className="feedback neutral">
      Seu acesso a este perfil é somente leitura.
    </p>
  );
}
