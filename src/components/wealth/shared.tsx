import Link from "next/link";
import { money, formatDate } from "@/lib/finance";
import { percent } from "@/lib/insights";
import { TriangleAlert } from "lucide-react";
import type { WealthOverview } from "@/types/wealth";
export function WealthNotice() {
  return (
    <section className="panel empty-chart">
      <h2>Os novos módulos aguardam ativação.</h2>
      <p>
        Revise e aplique manualmente a migration da Fase 4. Suas funcionalidades
        anteriores continuam disponíveis.
      </p>
      <Link className="button secondary" href="/app">
        Voltar à visão geral
      </Link>
    </section>
  );
}
export function WealthProgress({
  value,
  label = "Progresso",
}: {
  value: string | null;
  label?: string;
}) {
  return (
    <div className="budget-progress">
      <progress
        max={100}
        value={Math.max(0, Math.min(100, Number(value ?? 0)))}
        aria-label={label}
        aria-valuetext={percent(value)}
      />
      <span>
        {label}: {percent(value)}
      </span>
    </div>
  );
}
export function WealthAlerts({ data }: { data: WealthOverview }) {
  const alerts: string[] = [];
  for (const card of data.cards)
    if (Number(card.utilization) >= 80)
      alerts.push(
        `${card.name}: ${percent(card.utilization)} do limite comprometido.`,
      );
  for (const invoice of data.invoices_due) {
    const name =
      data.cards.find((c) => c.id === invoice.card_id)?.name ?? "Cartão";
    alerts.push(
      `${name}: fatura ${invoice.due_on < data.today ? "atrasada" : "a vencer"} em ${formatDate(invoice.due_on)} · ${money(invoice.total)}.`,
    );
  }
  for (const p of data.positions) {
    if (p.kind === "reserve" && Number(p.progress ?? 0) < 100)
      alerts.push(
        `Reserva abaixo do objetivo: ${percent(p.progress)} alcançado.`,
      );
    if (p.kind === "goal" && p.status === "active" && p.target_date) {
      const days =
        (Date.parse(p.target_date + "T12:00:00Z") -
          Date.parse(data.today + "T12:00:00Z")) /
        86400000;
      if (days <= 30 && Number(p.progress ?? 0) < 100)
        alerts.push(
          `Meta ${p.name}: prazo ${days < 0 ? "vencido" : "próximo"} (${formatDate(p.target_date)}).`,
        );
    }
  }
  if (data.net_worth.net_worth.startsWith("-"))
    alerts.push(
      "Seu patrimônio líquido está negativo. Revise os passivos registrados.",
    );
  if (!alerts.length) return null;
  return (
    <section className="panel analysis-panel">
      <h2>Atenção ao seu planejamento</h2>
      <ul className="financial-alerts">
        {alerts.map((text, i) => (
          <li className="attention" key={i}>
            <TriangleAlert size={19} />
            <p>{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
export function WealthSummary({ data }: { data: WealthOverview }) {
  const goal = data.positions
    .filter((p) => p.kind === "goal" && p.status === "active")
    .sort((a, b) =>
      (a.target_date ?? "9999").localeCompare(b.target_date ?? "9999"),
    )[0];
  const reserve = data.positions.find((p) => p.kind === "reserve");
  const investment = data.positions.some((p) => p.kind === "investment");
  const entries = [
    ...(data.cards.length
      ? [
          {
            title: "Cartões · próxima fatura",
            value: money(
              data.cards
                .filter((c) => c.current_invoice_id)
                .sort((a, b) =>
                  (a.due_on ?? "").localeCompare(b.due_on ?? ""),
                )[0]?.current_total ?? "0",
            ),
            href: "/app/cartoes",
          },
        ]
      : []),
    ...(goal
      ? [
          {
            title: goal.name,
            value: percent(goal.progress),
            href: "/app/metas",
          },
        ]
      : []),
    ...(reserve
      ? [
          {
            title: "Reserva de emergência",
            value: percent(reserve.progress),
            href: "/app/reserva",
          },
        ]
      : []),
    ...(investment
      ? [
          {
            title: "Investimentos",
            value: money(data.investment.current_value),
            href: "/app/investimentos",
          },
        ]
      : []),
    ...(data.items.length ||
    data.positions.length ||
    data.cards.length ||
    Number(data.net_worth.accounts) !== 0 ||
    Number(data.net_worth.overdraft) !== 0
      ? [
          {
            title: "Patrimônio líquido",
            value: money(data.net_worth.net_worth),
            href: "/app/patrimonio",
          },
        ]
      : []),
  ];
  if (!entries.length) return null;
  return (
    <>
      <section className="wealth-summary" aria-label="Seu planejamento">
        {entries.map((e) => (
          <article className="panel" key={e.href}>
            <span>{e.title}</span>
            <strong>{e.value}</strong>
            {e.href === "/app/investimentos" && (
              <small>Resultado: {money(data.investment.result)}</small>
            )}
            <Link href={e.href}>Ver detalhes →</Link>
          </article>
        ))}
      </section>
      <WealthAlerts data={data} />
    </>
  );
}
