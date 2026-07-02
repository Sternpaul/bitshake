'use client';

export default function KPICard({ icon, label, value, unit, detail, variant = 'consumption', loading }) {
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

  return (
    <div className={`kpi-card ${variant}`}>
      <div className="kpi-label">
        <span>{icon}</span>
        {label}
      </div>
      <div className={`kpi-value ${variant === 'consumption' ? 'consuming' : variant === 'solar' ? 'feeding' : ''}`}>
        {value}
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      {detail && <div className="kpi-detail">{detail}</div>}
    </div>
  );
}
