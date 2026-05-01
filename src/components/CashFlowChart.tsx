"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  label: string;
  billed: number;
  received: number;
  forecast: number;
}

interface Props {
  data: DataPoint[];
}

function formatK(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
}

export default function CashFlowChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatK} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value, name) => [
            new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value)),
            String(name),
          ]}
        />
        <Legend />
        <Bar dataKey="billed" name="Billed" fill="#3b82f6" radius={[3, 3, 0, 0]} />
        <Bar dataKey="received" name="Received" fill="#22c55e" radius={[3, 3, 0, 0]} />
        <Bar dataKey="forecast" name="Forecast" fill="#94a3b8" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
