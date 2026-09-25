"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { money, formatDate } from "@/lib/finance";
import type { SeriesPoint, Budget, Insights } from "@/types/insights";
const axis = (v: number) =>
  "R$ " + new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v);
type Pair = { label: string; first: string; second: string };
function PairChart({
  rows,
  names,
  line = false,
}: {
  rows: Pair[];
  names: [string, string];
  line?: boolean;
}) {
  const values = rows.map((r) => ({
    ...r,
    a: Number(r.first),
    b: Number(r.second),
  }));
  const contents = (
    <>
      <CartesianGrid vertical={false} stroke="#e9eef5" />
      <XAxis
        dataKey="label"
        tick={{ fontSize: 11 }}
        minTickGap={24}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        width={78}
        tickFormatter={axis}
        tick={{ fontSize: 11 }}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip
        content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const r = payload[0].payload as Pair;
          return (
            <div className="chart-tooltip">
              <strong>{r.label}</strong>
              <p>
                {names[0]}: {money(r.first)}
              </p>
              <p>
                {names[1]}: {money(r.second)}
              </p>
            </div>
          );
        }}
      />
      {line ? (
        <>
          <Line
            type="monotone"
            dataKey="a"
            name={names[0]}
            stroke="#087df0"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="b"
            name={names[1]}
            stroke="#dc784d"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        </>
      ) : (
        <>
          <Bar
            dataKey="a"
            name={names[0]}
            fill="#087df0"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="b"
            name={names[1]}
            fill="#97b6da"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </>
      )}
    </>
  );
  if (!values.some((r) => r.a || r.b))
    return (
      <div className="empty-chart">
        <p>Nenhuma movimentação neste período.</p>
      </div>
    );
  return (
    <>
      <div className="chart-legend">
        <span>
          <i className="legend-income" />
          {names[0]}
        </span>
        <span>
          <i style={{ background: line ? "#dc784d" : "#97b6da" }} />
          {names[1]}
        </span>
      </div>
      <div className="chart-canvas">
        <ResponsiveContainer width="100%" height="100%">
          {line ? (
            <LineChart data={values}>{contents}</LineChart>
          ) : (
            <BarChart data={values}>{contents}</BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <details className="chart-data">
        <summary>Ver valores em tabela</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Período / categoria</th>
                <th>{names[0]}</th>
                <th>{names[1]}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>{money(r.first)}</td>
                  <td>{money(r.second)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
export function MovementChart({
  points,
  monthly = false,
  cumulative = false,
}: {
  points: SeriesPoint[];
  monthly?: boolean;
  cumulative?: boolean;
}) {
  return (
    <PairChart
      rows={points.map((p) => ({
        label: monthly
          ? formatDate(p.date).slice(3)
          : formatDate(p.date).slice(0, 5),
        first: p.income,
        second: p.expense,
      }))}
      names={
        cumulative
          ? ["Receitas acumuladas", "Despesas acumuladas"]
          : ["Receitas", "Despesas"]
      }
      line={cumulative}
    />
  );
}
export function BudgetChart({ budget }: { budget: Budget }) {
  return (
    <PairChart
      rows={budget.categories.map((c) => ({
        label: c.name,
        first: c.planned,
        second: c.actual,
      }))}
      names={["Planejado", "Realizado"]}
    />
  );
}
export function KindsChart({ kinds }: { kinds: Insights["kinds"] }) {
  return (
    <PairChart
      rows={[
        {
          label: "Despesas realizadas",
          first: kinds.find((k) => k.kind === "fixed")?.amount ?? "0",
          second: kinds.find((k) => k.kind === "variable")?.amount ?? "0",
        },
      ]}
      names={["Fixas", "Variáveis"]}
    />
  );
}
