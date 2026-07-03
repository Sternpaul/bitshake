'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useTheme } from 'next-themes';
import { buildAdaptiveGradient } from '@/lib/chart-utils';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  const value = payload[0]?.value || 0;
  const isExporting = value < 0;

  return (
    <div className="custom-tooltip">
      <div className="label">{new Date(label).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
      <div className="value" style={{ color: isExporting ? 'hsl(38, 92%, 55%)' : 'hsl(210, 100%, 60%)' }}>
        {Math.abs(Math.round(value))} W {isExporting ? '(Einspeisung)' : '(Bezug)'}
      </div>
    </div>
  );
}

export default function LivePowerChart({ data = [], loading }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

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

  // Build adaptive heat-map gradient
  const { fillStops, strokeStops, zeroOffset } = buildAdaptiveGradient(formattedData, 'power', { isDark });

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
              <linearGradient id="adaptiveStrokeLive" x1="0" y1="0" x2="0" y2="1">
                {strokeStops.map((stop, i) => (
                  <stop key={i} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
                ))}
              </linearGradient>
              <linearGradient id="adaptiveFillLive" x1="0" y1="0" x2="0" y2="1">
                {fillStops.map((stop, i) => (
                  <stop key={i} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
                ))}
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
              stroke="url(#adaptiveStrokeLive)"
              fill="url(#adaptiveFillLive)"
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
