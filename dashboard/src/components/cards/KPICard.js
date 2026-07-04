'use client';

export default function KPICard({ icon, label, value, unit, detail, variant = 'consumption', loading, trend, trendInvert = false }) {
  if (loading) {
    return (
      <div className={`kpi-card ${variant}`}>
        <div className="kpi-label">
          <span>{icon}</span>
          <div className="skeleton skeleton-text" style={{ width: '80px' }} />
        </div>
        <div className="skeleton skeleton-value" />
      </div>
    );
  }

  let sleekTrend = null;
  if (trend !== undefined && trend !== null) {
    const isPositive = trend > 0;
    const isNeutral = Math.abs(trend) < 0.1;
    let isGood = trendInvert ? isPositive : !isPositive;
    if (isNeutral) isGood = true;

    const trendIcon = isNeutral ? '👉' : isPositive ? '📈' : '📉';
    const sign = isPositive ? '+' : '';
    
    const trendColor = isNeutral ? 'var(--text-secondary)' : isGood ? 'var(--success)' : 'var(--danger)';
    const trendBg = isNeutral ? 'var(--surface-sunken)' : isGood ? 'var(--success-bg)' : 'var(--danger-bg)';

    sleekTrend = (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '0.85rem',
        fontWeight: 'bold',
        padding: '2px 8px',
        borderRadius: '12px',
        background: trendBg,
        color: trendColor,
        marginLeft: '12px',
        verticalAlign: 'middle',
      }}>
        <span style={{ fontSize: '0.8rem' }}>{trendIcon}</span>
        {sign}{Math.abs(trend).toFixed(1)}%
      </span>
    );
  }

  return (
    <div className={`kpi-card ${variant}`}>
      <div className="kpi-label">
        <span>{icon}</span>
        {label}
      </div>
      <div className={`kpi-value ${variant === 'consumption' ? 'consuming' : variant === 'solar' ? 'feeding' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div>
            {value}
            {unit && <span className="kpi-unit">{unit}</span>}
          </div>
          {sleekTrend}
        </div>
      </div>
      {detail && <div className="kpi-detail">{detail}</div>}
    </div>
  );
}
