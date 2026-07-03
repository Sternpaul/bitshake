'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="custom-tooltip">
      <div className="label">Uhrzeit: {label}</div>
      {payload.map((entry, index) => (
        <div key={index} className="value" style={{ color: entry.color }}>
          {entry.name}: {Number(entry.value).toFixed(0)} W
        </div>
      ))}
    </div>
  );
}

export default function HourlyProfileChart({ data = [], loading }) {
  if (loading) {
    return (
      <div className="chart-card full-width">
        <div className="chart-title">Verbrauchs- und Erzeugungsprofil</div>
        <div className="chart-subtitle">Durchschnittliche Leistung nach Uhrzeit</div>
        <div className="chart-wrapper tall">
          <div className="skeleton" style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="chart-card full-width">
      <div className="chart-title">Verbrauchs- und Erzeugungsprofil</div>
      <div className="chart-subtitle">Durchschnittliche Leistung (W) je Stunde über den ausgewählten Zeitraum</div>
      <div className="chart-wrapper tall">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="hour_label"
              stroke="rgba(255,255,255,0.2)"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
              interval={1}
            />
            <YAxis
              stroke="rgba(255,255,255,0.2)"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
              tickFormatter={(v) => `${v} W`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar
              dataKey="avg_consumption_w"
              name="Ø Bezug"
              fill="hsl(210, 100%, 60%)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
            <Bar
              dataKey="avg_export_w"
              name="Ø Einspeisung"
              fill="hsl(38, 92%, 55%)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
