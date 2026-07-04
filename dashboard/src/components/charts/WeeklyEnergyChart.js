'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

export default function WeeklyEnergyChart({ data = [], loading }) {
  if (loading) {
    return (
      <div className="chart-card">
        <div className="chart-title">Diese Woche</div>
        <div className="chart-subtitle">Täglicher Bezug vs. Einspeisung</div>
        <div className="chart-wrapper">
          <div className="skeleton" style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    );
  }

  const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  const formattedData = data.map(d => {
    const date = new Date(d.bucket);
    return {
      day: dayNames[date.getDay()],
      date: date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
      consumed: Number(d.consumed_kwh || 0),
      exported: Number(d.exported_kwh || 0),
      generated_total: Number(d.generated_kwh || 0) + Number(d.generated_estimated_kwh || 0),
    };
  });

  return (
    <div className="chart-card">
      <div className="chart-title">Diese Woche</div>
      <div className="chart-subtitle">Täglicher Stromverbrauch vs. Einspeisung</div>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="day"
              stroke="rgba(255,255,255,0.2)"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
            />
            <YAxis
              stroke="rgba(255,255,255,0.2)"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
              tickFormatter={(v) => `${v} kWh`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar
              dataKey="consumed"
              name="Verbrauch"
              fill="hsl(210, 100%, 60%)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
            <Bar
              dataKey="exported"
              name="Einspeisung"
              fill="hsl(38, 92%, 55%)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
            <Bar
              dataKey="generated_total"
              name="Solarstrom"
              fill="var(--solar)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
