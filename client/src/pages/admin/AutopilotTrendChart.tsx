import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

/**
 * Single-series daily agent-activity trend for the Autopilot value dashboard.
 * Isolated into its own module so recharts (~150KB) code-splits into an async
 * chunk (same pattern as AdminCharts). One series → no legend; the section
 * title names it. Themed with the design tokens (primary fill, muted grid,
 * card tooltip) so it reads with the rest of the app in light and dark.
 */
const fmtTick = (d: string): string => {
  const [, m, day] = d.split("-");
  return `${Number(m)}/${Number(day)}`;
};

const fmtFull = (d: string): string => {
  const dt = new Date(`${d}T00:00:00Z`);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

export default function AutopilotTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-52 w-full" role="img" aria-label="Daily Autopilot activity over the selected range">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="autopilotTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={fmtTick}
            minTickGap={28}
            tickLine={false}
            axisLine={false}
            className="text-xs"
          />
          <YAxis
            allowDecimals={false}
            width={32}
            tickLine={false}
            axisLine={false}
            className="text-xs"
          />
          <Tooltip
            labelFormatter={(d: string) => fmtFull(d)}
            formatter={(value: number) => [value, "Activity"]}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#autopilotTrendFill)"
            dot={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
