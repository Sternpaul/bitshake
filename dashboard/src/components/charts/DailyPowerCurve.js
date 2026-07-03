'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="custom-tooltip">
      <div className="label">{label}</div>
      {payload.map((entry, index) => {
        const isExporting = entry.value < 0;
        return (
          <div key={index} className="value" style={{ color: isExporting ? 'hsl(38, 92%, 55%)' : 'hsl(210, 100%, 60%)' }}>
            {entry.name}: {Math.abs(Number(entry.value)).toFixed(1)} W {isExporting ? '(Einspeisung)' : '(Bezug)'}
          </div>
        );
      })}
    </div>
  );
}

export default function DailyPowerCurve({ data = [], loading }) {
  if (loading) {
    return (
      <div className="chart-card">
        <div className="chart-title">Heutige Leistungskurve</div>
        <div className="chart-subtitle">Bezug vs. Einspeisung über 24 Stunden</div>
        <div className="chart-wrapper">
          <div className="skeleton" style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    );
  }

  const formattedData = data.map(d => ({
    time: new Date(d.bucket).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    power: d.avg_power || 0,
  }));

  const calculateGradientOffset = (chartData) => {
    if (chartData.length === 0) return 0;
    const dataMax = Math.max(...chartData.map(i => i.power));
    const dataMin = Math.min(...chartData.map(i => i.power));
    if (dataMax <= 0) return 0;
    if (dataMin >= 0) return 1;
    return dataMax / (dataMax - dataMin);
  };
  const off = calculateGradientOffset(formattedData);

  return (
    <div className="chart-card">
      <div className="chart-title">Heutige Leistungskurve</div>
      <div className="chart-subtitle">Durchschnittliche Leistung pro 5-Minuten-Intervall</div>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="splitStrokeDaily" x1="0" y1="0" x2="0" y2="1">
                <stop offset={off} stopColor="hsl(210, 100%, 60%)" stopOpacity={1} />
                <stop offset={off} stopColor="hsl(38, 92%, 55%)" stopOpacity={1} />
              </linearGradient>
              <linearGradient id="splitFillDaily" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(210, 100%, 60%)" stopOpacity={0.25} />
                <stop offset={off} stopColor="hsl(210, 100%, 60%)" stopOpacity={0} />
                <stop offset={off} stopColor="hsl(38, 92%, 55%)" stopOpacity={0} />
                <stop offset="100%" stopColor="hsl(38, 92%, 55%)" stopOpacity={0.25} />
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
              dataKey="power"
              name="Leistung"
              stroke="url(#splitStrokeDaily)"
              fill="url(#splitFillDaily)"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
