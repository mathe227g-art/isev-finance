"use client";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { money, formatDate } from "@/lib/finance";
const colors = [
  "#087df0",
  "#5b72d8",
  "#36a59f",
  "#e2a454",
  "#8461ad",
  "#90b5d9",
];
export function AllocationChart({
  data,
}: {
  data: { name: string; value: string }[];
}) {
  const rows = data
    .filter((x) => Number(x.value) > 0)
    .map((x) => ({ ...x, n: Number(x.value) }));
  if (!rows.length)
    return (
      <div className="empty-chart">
        Sem valores positivos para exibir a composição.
      </div>
    );
  return (
    <>
      <div className="chart-canvas donut">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="n"
              nameKey="name"
              innerRadius="57%"
              outerRadius="82%"
              isAnimationActive={false}
            >
              {rows.map((r, i) => (
                <Cell key={r.name} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as (typeof rows)[number];
                return (
                  <div className="chart-tooltip">
                    <strong>{r.name}</strong>
                    <p>{money(r.value)}</p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="category-legend">
        {rows.map((r, i) => (
          <li key={r.name}>
            <span>
              <i style={{ background: colors[i % colors.length] }} />
              {r.name}
            </span>
            <strong>{money(r.value)}</strong>
          </li>
        ))}
      </ul>
    </>
  );
}
export function WealthEvolution({
  data,
}: {
  data: { date: string; value: string }[];
}) {
  if (data.length < 2)
    return (
      <div className="empty-chart">
        <h3>Histórico ainda insuficiente</h3>
        <p>
          A evolução aparecerá a partir de dois dias registrados. Nenhum período
          anterior será inventado.
        </p>
        {data[0] && (
          <strong>
            {formatDate(data[0].date)} · {money(data[0].value)}
          </strong>
        )}
      </div>
    );
  const rows = data.map((r) => ({
    ...r,
    n: Number(r.value),
    label: formatDate(r.date),
  }));
  return (
    <>
      <div className="chart-canvas">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid vertical={false} stroke="#e9eef5" />
            <XAxis dataKey="label" minTickGap={32} tick={{ fontSize: 11 }} />
            <YAxis
              width={80}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) =>
                "R$ " +
                new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(
                  v,
                )
              }
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as (typeof rows)[number];
                return (
                  <div className="chart-tooltip">
                    {r.label}
                    <p>{money(r.value)}</p>
                  </div>
                );
              }}
            />
            <Line
              dataKey="n"
              stroke="#087df0"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-data">
        <summary>Ver registros</summary>
        <ul className="category-legend">
          {rows.map((r) => (
            <li key={r.date}>
              <span>{r.label}</span>
              <strong>{money(r.value)}</strong>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
export function AssetsLiabilities({
  assets,
  liabilities,
}: {
  assets: string;
  liabilities: string;
}) {
  const rows = [
    { name: "Ativos", value: assets, n: Number(assets) },
    { name: "Passivos", value: liabilities, n: Number(liabilities) },
  ];
  return (
    <div className="chart-canvas">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows}>
          <XAxis dataKey="name" />
          <YAxis
            width={80}
            tickFormatter={(v) =>
              "R$ " +
              new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v)
            }
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as (typeof rows)[number];
              return (
                <div className="chart-tooltip">
                  {r.name}
                  <p>{money(r.value)}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="n" isAnimationActive={false} radius={[5, 5, 0, 0]}>
            {rows.map((r, i) => (
              <Cell key={r.name} fill={i ? "#d78470" : "#087df0"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
