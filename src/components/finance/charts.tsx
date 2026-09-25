"use client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { DashboardData } from "@/types/finance";
import { money, monthLabel } from "@/lib/finance";
export function FinanceCharts({
  data,
  onlyCategories = false,
}: {
  data: DashboardData;
  onlyCategories?: boolean;
}) {
  const history = data.history.map((h) => ({
    ...h,
    label: monthLabel(h.month.slice(0, 7)),
    incomeValue: Number(h.income),
    expenseValue: Number(h.expense),
  }));
  const categories = data.categories.map((c) => ({
    ...c,
    value: Number(c.amount),
  }));
  const hasActivity = history.some(
    (h) => h.incomeValue !== 0 || h.expenseValue !== 0,
  );
  return (
    <div
      className={onlyCategories ? "category-chart-only" : "finance-chart-grid"}
    >
      {!onlyCategories && (
        <section className="panel">
          <div className="section-heading">
            <h2>Receitas × despesas</h2>
            <span className="muted">Últimos 6 meses</span>
          </div>
          {hasActivity ? (
            <>
              <div className="chart-legend">
                <span>
                  <i className="legend-income" />
                  Receitas
                </span>
                <span>
                  <i className="legend-expense" />
                  Despesas
                </span>
              </div>
              <div className="chart-canvas">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={history}
                    margin={{ top: 10, right: 0, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke="#e9eef5" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => String(v).slice(0, 3)}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      width={55}
                      tickFormatter={(v) =>
                        new Intl.NumberFormat("pt-BR", {
                          notation: "compact",
                        }).format(Number(v))
                      }
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0]
                          .payload as (typeof history)[number];
                        return (
                          <div className="chart-tooltip">
                            <strong>{row.label}</strong>
                            <p>Receitas: {money(row.income)}</p>
                            <p>Despesas: {money(row.expense)}</p>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="incomeValue"
                      name="Receitas"
                      fill="#087df0"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="expenseValue"
                      name="Despesas"
                      fill="#97b6da"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <details className="chart-data">
                <summary>Ver valores em tabela</summary>
                <table>
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th>Receitas</th>
                      <th>Despesas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.month}>
                        <td>{h.label}</td>
                        <td>{money(h.income)}</td>
                        <td>{money(h.expense)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          ) : (
            <div className="empty-chart">
              <h3>Ainda sem movimentações concluídas</h3>
              <p>
                Quando houver receitas recebidas ou despesas realizadas, sua evolução
                aparecerá aqui.
              </p>
            </div>
          )}
        </section>
      )}
      <section className="panel">
        <div className="section-heading">
          <h2>Despesas por categoria</h2>
          <span className="muted">No período</span>
        </div>
        {categories.length ? (
          <>
            <div className="chart-canvas donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="57%"
                    outerRadius="82%"
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {categories.map((c) => (
                      <Cell key={c.id} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const c = payload[0]
                        .payload as (typeof categories)[number];
                      return (
                        <div className="chart-tooltip">
                          <strong>{c.name}</strong>
                          <p>
                            {money(c.amount)} · {c.percentage.replace(".", ",")}
                            %
                          </p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="category-legend">
              {categories.map((c) => (
                <li key={c.id}>
                  <span>
                    <i style={{ background: c.color }} />
                    {c.name}
                  </span>
                  <strong>
                    {money(c.amount)}{" "}
                    <small>({c.percentage.replace(".", ",")}%)</small>
                  </strong>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="empty-chart">
            <h3>Nenhuma despesa paga neste mês</h3>
            <p>Despesas pendentes não entram nesta distribuição.</p>
          </div>
        )}
      </section>
    </div>
  );
}
