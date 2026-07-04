'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="custom-tooltip">
      <div className="label">{label}</div>
      {payload.map((entry, index) => (
        <div key={index} className="value" style={{ color: entry.color }}>
          {entry.name}: {Number(entry.value).toFixed(2)} kWh
        </div>
      ))}
    </div>
  );
}

export default function MonthlyTrendChart({ data = [], loading }) {
  if (loading) {
    return (
      <div className="chart-card">
        <div className="chart-title">Dieser Monat</div>
        <div className="chart-subtitle">Täglicher Energie-Trend</div>
        <div className="chart-wrapper">
          <div className="skeleton" style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    );
  }

  const formattedData = data.map(d => ({
    date: new Date(d.bucket).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
    consumed: Number(d.consumed_kwh || 0),
    exported: Number(d.exported_kwh || 0),
    generated: Number(d.generated_kwh || 0),
    generated_estimated: Number(d.generated_estimated_kwh || 0),
  }));

  const showDots = formattedData.length <= 5;

  return (
    <div className="chart-card">
      <div className="chart-title">Dieser Monat</div>
      <div className="chart-subtitle">Trend des täglichen Energieverbrauchs</div>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="monthConsumption" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(210, 100%, 60%)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(210, 100%, 60%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="monthExport" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(38, 92%, 55%)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(38, 92%, 55%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="monthSolar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(38, 92%, 55%)" stopOpacity={0.7} />
                <stop offset="95%" stopColor="hsl(38, 92%, 55%)" stopOpacity={0.2} />
              </linearGradient>
              <pattern id="striped-month" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="4" height="8" fill="hsl(38, 92%, 70%)" fillOpacity="0.4" />
                <rect x="4" width="4" height="8" fill="transparent" />
              </pattern>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="date"
              stroke="rgba(255,255,255,0.2)"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="rgba(255,255,255,0.2)"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
              tickFormatter={(v) => `${v} kWh`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Area
              type="monotone"
              dataKey="consumed"
              name="Verbrauch"
              stroke="hsl(210, 100%, 60%)"
              fill="url(#monthConsumption)"
              strokeWidth={2}
              dot={showDots ? { r: 3, fill: 'var(--bg-card)' } : false}
              activeDot={{ r: 5 }}
            />
            <Area
              type="monotone"
              dataKey="exported"
              name="Einspeisung"
              stroke="hsl(38, 92%, 55%)"
              fill="url(#monthExport)"
              strokeWidth={2}
              dot={showDots ? { r: 3, fill: 'var(--bg-card)' } : false}
              activeDot={{ r: 5 }}
            />
            <Area
              type="monotone"
              dataKey="generated"
              name="Solarstrom (Roh)"
              stroke="hsl(38, 92%, 55%)"
              fill="url(#monthSolar)"
              strokeWidth={2}
              stackId="solar"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="generated_estimated"
              name="Solarstrom (Geschätzt)"
              stroke="hsl(38, 92%, 70%)"
              strokeDasharray="4 4"
              fill="url(#striped-month)"
              strokeWidth={1.5}
              stackId="solar"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
