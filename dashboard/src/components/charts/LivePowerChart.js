'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="custom-tooltip">
      <div className="label">{new Date(label).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
      {payload.map((entry, index) => (
        <div key={index} className="value" style={{ color: entry.color }}>
          {entry.name}: {Math.round(entry.value)} W
        </div>
      ))}
    </div>
  );
}

export default function LivePowerChart({ data = [], loading }) {
  if (loading) {
    return (
      <div className="chart-card full-width">
        <div className="chart-title">Aktuelle Leistung</div>
        <div className="chart-subtitle">Letzte 30 Minuten</div>
        <div className="chart-wrapper">
          <div className="skeleton" style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    );
  }

  const formattedData = data.map(d => ({
    ...d,
    time: new Date(d.time).getTime(),
    power: d.power_current || 0,
  }));

  // Determine if currently importing or exporting
  const latestPower = formattedData.length > 0 ? formattedData[formattedData.length - 1].power : 0;
  const isExporting = latestPower < 0;

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
    <div className="chart-card full-width">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="chart-title">Aktuelle Leistung</div>
          <div className="chart-subtitle">Letzte 30 Minuten</div>
        </div>
        <div style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: isExporting ? 'var(--solar)' : 'var(--consumption)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.abs(Math.round(latestPower))} W
          <span style={{ fontSize: '0.75rem', fontWeight: 400, marginLeft: '4px', color: 'var(--text-tertiary)' }}>
            {isExporting ? '↑ Einspeisung' : '↓ Bezug'}
          </span>
        </div>
      </div>
      <div className="chart-wrapper tall">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="splitStroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset={off} stopColor="hsl(210, 100%, 60%)" stopOpacity={1} />
                <stop offset={off} stopColor="hsl(38, 92%, 55%)" stopOpacity={1} />
              </linearGradient>
              <linearGradient id="splitFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(210, 100%, 60%)" stopOpacity={0.3} />
                <stop offset={off} stopColor="hsl(210, 100%, 60%)" stopOpacity={0} />
                <stop offset={off} stopColor="hsl(38, 92%, 55%)" stopOpacity={0} />
                <stop offset="100%" stopColor="hsl(38, 92%, 55%)" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="time"
              type="number"
              domain={['auto', 'auto']}
              tickFormatter={(t) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              stroke="rgba(255,255,255,0.2)"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
            />
            <YAxis
              stroke="rgba(255,255,255,0.2)"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
              tickFormatter={(v) => `${v}W`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
            <Area
              type="monotone"
              dataKey="power"
              name="Leistung"
              stroke="url(#splitStroke)"
              fill="url(#splitFill)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
