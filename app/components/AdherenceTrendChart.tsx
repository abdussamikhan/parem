/**
 * app/components/AdherenceTrendChart.tsx
 * Weekly adherence line chart — used on Clinical page.
 */
'use client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TrendPoint } from '@/app/hooks/useDashboard';

type Props = { data: TrendPoint[] };

export function AdherenceTrendChart({ data }: Props) {
  return (
    <div className="chart-panel">
      <h3 className="chart-title">Weekly Adherence Trend</h3>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,.06)" />
            <XAxis
              dataKey="name"
              axisLine={false} tickLine={false}
              tick={{ fill: 'rgba(255,255,255,.4)', fontSize: 11 }} dy={8}
            />
            <YAxis
              axisLine={false} tickLine={false}
              tick={{ fill: 'rgba(255,255,255,.4)', fontSize: 11 }}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: '#1a1a2e', border: '1px solid rgba(255,255,255,.1)',
                borderRadius: 10, color: '#fff', fontSize: 12,
              }}
              labelStyle={{ color: 'rgba(255,255,255,.6)', marginBottom: 4 }}
              formatter={(val) => [`${Number(val)}%`, 'Adherence Rate']}
            />
            <Line
              type="monotone" dataKey="rate"
              stroke="url(#chartGrad)" strokeWidth={2.5}
              dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#a855f7' }}
            />
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#6366f1" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </LineChart>
        </ResponsiveContainer>
      </div>

      <style>{`
        .chart-panel {
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 18px; padding: 1.5rem;
          display: flex; flex-direction: column; gap: 1rem;
        }
        .chart-title { font-size: 1rem; font-weight: 700; color: #fff; }
        .chart-body { height: 220px; }
      `}</style>
    </div>
  );
}
