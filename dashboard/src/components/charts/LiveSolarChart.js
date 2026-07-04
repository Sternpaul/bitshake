'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useTheme } from 'next-themes';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  const value = payload[0]?.value || 0;

  return (
    <div className="custom-tooltip">
      <div className="label">{new Date(label).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
      <div className="value" style={{ color: 'var(--solar)' }}>
        {Math.round(value)} W (Solarstrom)
      </div>
    </div>
  );
}

export default function LiveSolarChart({ data = [], loading }) {
  const { resolvedTheme } = useTheme();

  if (loading) {
    return (
      <div className="chart-card full-width" style={{ marginTop: 'var(--space-6)' }}>
        <div className="chart-title">Solarproduktion</div>
        <div className="chart-subtitle">Letzte 30 Minuten (Generierung)</div>
        <div className="chart-wrapper">
          <div className="skeleton" style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    );
  }

  const formattedData = data.map(d => ({
    ...d,
    time: new Date(d.time).getTime(),
    solar: d.solar_power || 0,
  }));

  const latestSolar = formattedData.length > 0 ? formattedData[formattedData.length - 1].solar : 0;

  return (
    <div className="chart-card full-width" style={{ marginTop: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="chart-title">Solarproduktion</div>
          <div className="chart-subtitle">Letzte 30 Minuten</div>
        </div>
        <div style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: 'var(--solar)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {Math.round(latestSolar)} W
          <span style={{ fontSize: '0.75rem', fontWeight: 400, marginLeft: '4px', color: 'var(--text-tertiary)' }}>
            Erzeugung
          </span>
        </div>
      </div>
      <div className="chart-wrapper tall">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="solarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(38, 92%, 55%)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(38, 92%, 55%)" stopOpacity={0} />
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
            <Area
              type="monotone"
              dataKey="solar"
              name="Solarstrom"
              stroke="hsl(38, 92%, 55%)"
              fill="url(#solarGradient)"
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
