'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="custom-tooltip">
      <div className="label">{label}</div>
      {payload.map((entry, index) => (
        <div key={index} className="value" style={{ color: entry.color }}>
          {entry.name}: {Number(entry.value).toFixed(1)} W
        </div>
      ))}
    </div>
  );
}

export default function DailyPowerCurve({ data = [], loading }) {
  if (loading) {
    return (
      <div className="chart-card">
        <div className="chart-title">Today&apos;s Power Curve</div>
        <div className="chart-subtitle">Consumption vs Feed-in over 24 hours</div>
        <div className="chart-wrapper">
          <div className="skeleton" style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    );
  }

  const formattedData = data.map(d => ({
    time: new Date(d.bucket).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    consumption: Math.max(0, d.avg_power || 0),
    feedin: Math.abs(Math.min(0, d.avg_power || 0)),
  }));

  return (
    <div className="chart-card">
      <div className="chart-title">Today&apos;s Power Curve</div>
      <div className="chart-subtitle">Average power per 5-minute interval</div>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="consumptionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(210, 100%, 60%)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="hsl(210, 100%, 60%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="feedinGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(38, 92%, 55%)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="hsl(38, 92%, 55%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="time"
              stroke="rgba(255,255,255,0.2)"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="rgba(255,255,255,0.2)"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
              tickFormatter={(v) => `${v}W`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)' }}
            />
            <Area
              type="monotone"
              dataKey="consumption"
              name="Consumption"
              stroke="hsl(210, 100%, 60%)"
              fill="url(#consumptionGradient)"
              strokeWidth={2}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="feedin"
              name="Feed-in"
              stroke="hsl(38, 92%, 55%)"
              fill="url(#feedinGradient)"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
