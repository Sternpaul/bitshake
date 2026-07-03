'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { buildAdaptiveGradient } from '@/lib/chart-utils';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  const value = payload[0]?.value || 0;
  const isExporting = value < 0;

  return (
    <div className="custom-tooltip">
      <div className="label">{label}</div>
      <div className="value" style={{ color: isExporting ? 'hsl(38, 92%, 55%)' : 'hsl(210, 100%, 60%)' }}>
        {Math.abs(Number(value)).toFixed(1)} W {isExporting ? '(Einspeisung)' : '(Bezug)'}
      </div>
    </div>
  );
}

export default function DailyPowerCurve({ data = [], loading }) {
  if (loading) {
    return (
      <div className="chart-card">
        <div className="chart-title">Heutige Leistungskurve</div>
        <div className="chart-subtitle">Durchschnittliche Leistung pro Stunde</div>
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

  // Build adaptive heat-map gradient
  const { fillStops, strokeStops } = buildAdaptiveGradient(formattedData, 'power');

  return (
    <div className="chart-card">
      <div className="chart-title">Heutige Leistungskurve</div>
      <div className="chart-subtitle">Durchschnittliche Leistung pro Stunde</div>
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="adaptiveStrokeDaily" x1="0" y1="0" x2="0" y2="1">
                {strokeStops.map((stop, i) => (
                  <stop key={i} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
                ))}
              </linearGradient>
              <linearGradient id="adaptiveFillDaily" x1="0" y1="0" x2="0" y2="1">
                {fillStops.map((stop, i) => (
                  <stop key={i} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
                ))}
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
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
            <Area
              type="monotone"
              dataKey="power"
              name="Leistung"
              stroke="url(#adaptiveStrokeDaily)"
              fill="url(#adaptiveFillDaily)"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
