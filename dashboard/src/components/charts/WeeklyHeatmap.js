'use client';

import { useState } from 'react';

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function WeeklyHeatmap({ data = [], loading, rangeLabel = '' }) {
  const [hoveredCell, setHoveredCell] = useState(null);

  if (loading) {
    return (
      <div className="chart-card full-width">
        <div className="chart-title">Wochen-Heatmap</div>
        <div className="chart-subtitle">Durchschnittlicher Verbrauch nach Wochentag und Stunde</div>
        <div className="chart-wrapper tall">
          <div className="skeleton" style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    );
  }

  // Find max value to normalize colors
  let maxVal = 1;
  data.forEach(dayRow => {
    dayRow.forEach(cell => {
      if (cell.value > maxVal) maxVal = cell.value;
    });
  });

  // Color interpolator (from faint red/blue to strong red)
  // Let's use a red scale since this is consumption
  const getColor = (val) => {
    if (val === 0) return 'rgba(255,255,255,0.02)';
    
    // Normalize between 0 and 1
    const intensity = Math.min(1, Math.max(0.1, val / maxVal));
    
    // Convert to HSL: Red (0), varying lightness and saturation
    // 0.1 intensity = faint pink/dark red, 1.0 intensity = bright red
    const lightness = 60 - (intensity * 20); // 60% down to 40%
    const alpha = 0.2 + (intensity * 0.8); // 0.2 up to 1.0
    
    return `hsla(350, 80%, ${lightness}%, ${alpha})`;
  };

  return (
    <div className="chart-card full-width">
      <div className="chart-title">Wochen-Heatmap</div>
      <div className="chart-subtitle">Durchschnittlicher Verbrauch nach Wochentag und Stunde {rangeLabel ? `— ${rangeLabel}` : ''}</div>
      
      <div className="chart-wrapper tall" style={{ overflowX: 'auto', paddingRight: '1rem', position: 'relative' }}>
        
        {hoveredCell && (
          <div className="custom-tooltip" style={{ 
            position: 'absolute', 
            top: hoveredCell.y - 40, 
            left: hoveredCell.x, 
            pointerEvents: 'none', 
            zIndex: 10,
            transform: 'translateX(-50%)'
          }}>
            <div className="label">{DAYS[hoveredCell.day]} um {String(hoveredCell.hour).padStart(2, '0')}:00</div>
            <div className="value" style={{ color: 'hsl(350, 100%, 70%)' }}>
              Ø {Math.round(hoveredCell.value)} W
            </div>
          </div>
        )}

        <div style={{ minWidth: '600px', display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '20px' }}>
          
          {/* X Axis Header (Hours) */}
          <div style={{ display: 'flex', marginLeft: '40px' }}>
            {HOURS.map(h => (
              <div key={h} style={{ flex: 1, textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                {h % 2 === 0 ? h : ''}
              </div>
            ))}
          </div>

          {/* Grid */}
          {data.map((dayRow, dIndex) => (
            <div key={dIndex} style={{ display: 'flex', alignItems: 'center' }}>
              {/* Y Axis Label (Days) */}
              <div style={{ width: '40px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
                {DAYS[dIndex]}
              </div>
              
              {/* Cells */}
              <div style={{ display: 'flex', flex: 1, gap: '4px' }}>
                {dayRow.map((cell, hIndex) => (
                  <div 
                    key={hIndex}
                    style={{ 
                      flex: 1, 
                      aspectRatio: '1', 
                      backgroundColor: getColor(cell.value),
                      borderRadius: '4px',
                      cursor: 'crosshair',
                      border: '1px solid rgba(255,255,255,0.05)',
                      transition: 'transform 0.1s ease',
                      transform: hoveredCell?.day === dIndex && hoveredCell?.hour === hIndex ? 'scale(1.1)' : 'scale(1)',
                      zIndex: hoveredCell?.day === dIndex && hoveredCell?.hour === hIndex ? 5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      const rect = e.target.getBoundingClientRect();
                      const parentRect = e.target.parentElement.parentElement.parentElement.getBoundingClientRect();
                      setHoveredCell({
                        day: dIndex,
                        hour: hIndex,
                        value: cell.value,
                        x: rect.left - parentRect.left + (rect.width / 2),
                        y: rect.top - parentRect.top
                      });
                    }}
                    onMouseLeave={() => setHoveredCell(null)}
                  />
                ))}
              </div>
            </div>
          ))}
          
        </div>
      </div>
    </div>
  );
}
