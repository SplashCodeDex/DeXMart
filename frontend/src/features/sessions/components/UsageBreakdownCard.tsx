import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionUsage } from "../hooks/useSessionUsage";

interface UsageBreakdownCardProps {
  usage: SessionUsage | null;
  isLoading: boolean;
}

export function UsageBreakdownCard({
  usage,
  isLoading,
}: UsageBreakdownCardProps): React.JSX.Element {
  if (isLoading) {
    return (
      <Card className="border-border/50 rounded-3xl overflow-hidden animate-pulse">
        <CardHeader className="bg-muted/30 border-b border-border/50 py-4 px-6">
          <div className="h-4 w-32 bg-muted rounded" />
        </CardHeader>
        <CardContent className="p-6 h-64 flex items-center justify-center">
          <div className="w-full h-full bg-muted/20 rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!usage) return <></>;

  const data = [
    { name: "Input", tokens: usage.totals.input, color: "var(--color-primary-500)" },
    { name: "Output", tokens: usage.totals.output, color: "var(--color-accent-500)" },
  ];

  return (
    <Card className="border-border/50 rounded-3xl overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border/50 py-4 px-6">
        <CardTitle className="text-sm font-black uppercase tracking-widest">
          Token Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ left: -20, right: 20, top: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="var(--color-border)"
                opacity={0.5}
              />
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{
                  fontSize: 10,
                  fontWeight: 900,
                  fill: "var(--color-muted-foreground)",
                  textAnchor: "start",
                }}
                width={60}
              />
              <Tooltip
                cursor={{ fill: "var(--color-muted)", opacity: 0.1 }}
                contentStyle={{
                  backgroundColor: "var(--color-card)",
                  borderColor: "var(--color-border)",
                  borderRadius: "1rem",
                  fontSize: "10px",
                  fontWeight: "900",
                  textTransform: "uppercase",
                  boxShadow: "var(--shadow-lg)",
                }}
              />
              <Bar dataKey="tokens" radius={[0, 4, 4, 0]} barSize={24}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="space-y-0.5">
            <div className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground">
              Total Tokens
            </div>
            <div className="text-sm font-bold">{usage.totals.totalTokens.toLocaleString()}</div>
          </div>
          <div className="space-y-0.5 text-right">
            <div className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground">
              Total Cost
            </div>
            <div className="text-sm font-bold text-primary">
              ${usage.totals.totalCost.toFixed(4)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
