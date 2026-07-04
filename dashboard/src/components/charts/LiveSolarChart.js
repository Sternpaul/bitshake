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
        {Math.round(payload.find(p => p.dataKey === 'solar_raw')?.value || 0)} W (Roh)
      </div>
      <div className="value" style={{ color: 'hsl(38, 92%, 70%)', opacity: 0.8 }}>
        + {Math.round(payload.find(p => p.dataKey === 'solar_estimated')?.value || 0)} W (Geschätzt)
      </div>
      <div className="value" style={{ fontWeight: 'bold', marginTop: '4px' }}>
        Gesamt: {Math.round((payload.find(p => p.dataKey === 'solar_raw')?.value || 0) + (payload.find(p => p.dataKey === 'solar_estimated')?.value || 0))} W
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
    solar_raw: d.solar_power || 0,
    solar_estimated: d.solar_estimated_power || 0,
  }));

  const latestRaw = formattedData.length > 0 ? formattedData[formattedData.length - 1].solar_raw : 0;
  const latestEst = formattedData.length > 0 ? formattedData[formattedData.length - 1].solar_estimated : 0;
  const latestSolar = latestRaw + latestEst;

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
                <stop offset="5%" stopColor="hsl(38, 92%, 55%)" stopOpacity={0.7} />
                <stop offset="95%" stopColor="hsl(38, 92%, 55%)" stopOpacity={0.2} />
              </linearGradient>
              {/* Striped pattern for estimated data */}
              <pattern id="striped" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="4" height="8" fill="hsl(38, 92%, 70%)" fillOpacity="0.4" />
                <rect x="4" width="4" height="8" fill="transparent" />
              </pattern>
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
              dataKey="solar_raw"
              name="Solarstrom (Roh)"
              stroke="hsl(38, 92%, 55%)"
              fill="url(#solarGradient)"
              strokeWidth={2}
              stackId="1"
              dot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="solar_estimated"
              name="Solarstrom (Geschätzt)"
              stroke="hsl(38, 92%, 70%)"
              strokeDasharray="4 4"
              fill="url(#striped)"
              strokeWidth={1.5}
              stackId="1"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
