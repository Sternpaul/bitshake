'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, api } from '@/lib/api';
import { AuthProvider } from '@/lib/auth-context';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import HourlyProfileChart from '@/components/charts/HourlyProfileChart';
import WeeklyHeatmap from '@/components/charts/WeeklyHeatmap';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">{label}</div>
      {payload.map((entry, index) => (
        <div key={index} className="value" style={{ color: entry.color }}>
          {entry.name}: {Number(entry.value).toFixed(2)} {entry.name.includes('Power') ? 'W' : 'kWh'}
        </div>
      ))}
    </div>
  );
}

function AnalyticsContent() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [range, setRange] = useState('7d');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [profileData, setProfileData] = useState([]);
  const [trends, setTrends] = useState(null);
  const [heatmapData, setHeatmapData] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const daysForProfile = range === '24h' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 365;
      
      const [historyRes, overviewRes, profileRes, trendsRes, heatmapRes] = await Promise.allSettled([
        api.getHistory(range),
        api.getOverview(),
        api.getHourlyProfile(daysForProfile),
        api.getComparison(range),
        api.getHeatmap(daysForProfile),
      ]);

      if (historyRes.status === 'fulfilled') setData(historyRes.value.data || []);
      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value);
      if (profileRes.status === 'fulfilled') setProfileData(profileRes.value.data || []);
      if (trendsRes.status === 'fulfilled') setTrends(trendsRes.value);
      if (heatmapRes.status === 'fulfilled') setHeatmapData(heatmapRes.value.data || []);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    fetchData();
  }, [router, fetchData]);

  const ranges = [
    { key: '24h', label: '24 Stunden' },
    { key: '7d', label: '7 Tage' },
    { key: '30d', label: '30 Tage' },
    { key: '1y', label: '1 Jahr' },
  ];

  const formatDate = (bucket) => {
    const d = new Date(bucket);
    if (range === '24h') return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    if (range === '7d') return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit' });
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  const chartData = data.map(d => ({
    label: formatDate(d.bucket),
    consumed: Number(d.consumed_kwh || 0),
    exported: Number(d.exported_kwh || 0),
    avg_power: Number(d.avg_power || 0),
    max_power: Number(d.max_power || 0),
  }));

  const totalConsumed = chartData.reduce((sum, d) => sum + d.consumed, 0);
  const totalExported = chartData.reduce((sum, d) => sum + d.exported, 0);
  const avgPower = chartData.length > 0 ? chartData.reduce((sum, d) => sum + d.avg_power, 0) / chartData.length : 0;
  const peakPower = chartData.length > 0 ? Math.max(...chartData.map(d => d.max_power)) : 0;

  const showDots = chartData.length <= 5;

  const price = overview?.settings?.electricity_price || 0.35;
  const tariff = overview?.settings?.feedin_tariff || 0;
  const enableFeedin = overview?.settings?.enable_feedin_tariff === 'true';

  // --- Calculations: Base Load & Yearly Projection ---
  const validProfiles = profileData.filter(p => p.avg_consumption_w > 0);
  const baseLoadW = validProfiles.length > 0 ? Math.min(...validProfiles.map(p => p.avg_consumption_w)) : 0;
  
  // Fix 24h projection bug by dividing by 1 day instead of 288 buckets
  const actualDays = range === '24h' ? 1 : (chartData.length || 1);
  const avgDailyConsumed = totalConsumed / actualDays;
  const avgDailyExported = totalExported / actualDays;
  
  const projectedYearlyConsumed = avgDailyConsumed * 365;
  const projectedYearlyExported = avgDailyExported * 365;
  const projectedYearlyCost = projectedYearlyConsumed * price;
  const projectedYearlyEarnings = projectedYearlyExported * tariff;
  const projectedYearlyNet = enableFeedin ? projectedYearlyCost - projectedYearlyEarnings : projectedYearlyCost;

  // --- Trend Badge Component ---
  const TrendBadge = ({ pct, invertColors = false }) => {
    if (pct === null || pct === undefined) return null; // Not enough data yet
    
    const isIncrease = pct > 0;
    const absPct = Math.abs(pct).toFixed(1);
    
    // Invert colors: normally increase is bad (red), decrease is good (green).
    // For solar export, increase is good (green), decrease is bad (red).
    const isGood = invertColors ? isIncrease : !isIncrease;
    const isStrong = Math.abs(pct) > 10;
    
    // Determine CSS classes for dynamic styling
    let badgeClass = 'trend-badge ';
    if (isGood) {
      badgeClass += isStrong ? 'trend-good-strong' : 'trend-good-light';
    } else {
      badgeClass += isStrong ? 'trend-bad-strong' : 'trend-bad-light';
    }

    return (
      <div className={badgeClass} style={{ 
        position: 'absolute', 
        top: '16px', 
        right: '16px', 
        padding: '2px 8px', 
        borderRadius: '12px', 
        fontSize: '0.75rem', 
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: isGood ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
        color: isGood ? (isStrong ? '#4ade80' : '#86efac') : (isStrong ? '#f87171' : '#fca5a5'),
        border: `1px solid ${isGood ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
      }}>
        <span>{isIncrease ? '📈' : '📉'}</span>
        <span>{isIncrease ? '+' : '-'}{absPct}%</span>
      </div>
    );
  };

  return (
    <div className="app-layout">
      <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header />

      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">Analysen</h1>
          <p className="page-subtitle">Detaillierte Energieanalyse und historische Daten</p>
        </div>

        {/* Range Selector */}
        <div className="analytics-controls">
          <div className="range-tabs">
            {ranges.map(r => (
              <button
                key={r.key}
                className={`range-tab ${range === r.key ? 'active' : ''}`}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary KPIs for selected range */}
        <div className="kpi-grid" style={{ marginBottom: 'var(--space-8)' }}>
          <div className="kpi-card consumption" style={{ position: 'relative' }}>
            <TrendBadge pct={trends?.trend_consumed_pct} invertColors={false} />
            <div className="kpi-label"><span>📊</span> Gesamtverbrauch</div>
            <div className="kpi-value consuming">{totalConsumed.toFixed(1)}<span className="kpi-unit">kWh</span></div>
            <div className="kpi-detail">Kosten im Zeitraum: {(totalConsumed * price).toFixed(2)} €</div>
            <div className="kpi-detail" style={{ marginTop: '4px', opacity: 0.7 }}>Jahr-Prognose: {projectedYearlyConsumed.toFixed(0)} kWh</div>
          </div>
          
          <div className="kpi-card solar" style={{ position: 'relative' }}>
            <TrendBadge pct={trends?.trend_exported_pct} invertColors={true} />
            <div className="kpi-label"><span>☀️</span> Gesamteinspeisung</div>
            <div className="kpi-value feeding">{totalExported.toFixed(1)}<span className="kpi-unit">kWh</span></div>
            <div className="kpi-detail">
              {enableFeedin ? `Ersparnis im Zeitraum: ${(totalExported * tariff).toFixed(2)} €` : 'Einspeisevergütung deaktiviert'}
            </div>
            <div className="kpi-detail" style={{ marginTop: '4px', opacity: 0.7 }}>Jahr-Prognose: {projectedYearlyExported.toFixed(0)} kWh</div>
          </div>
          
          <div className="kpi-card">
            <div className="kpi-label"><span>⚡</span> Leistung</div>
            <div className="kpi-value">{Math.round(avgPower)}<span className="kpi-unit">W Ø</span></div>
            <div className="kpi-detail">Spitze: {Math.round(peakPower)} W</div>
            <div className="kpi-detail" style={{ marginTop: '4px', opacity: 0.7 }}>
              Standby: {baseLoadW > 0 ? `${Math.round(baseLoadW)} W` : 'Berechne...'}
            </div>
          </div>
          
          <div className="kpi-card success">
            <div className="kpi-label"><span>💰</span> {enableFeedin ? 'Netto Kosten' : 'Stromkosten'}</div>
            <div className="kpi-value">{enableFeedin ? ((totalConsumed * price) - (totalExported * tariff)).toFixed(2) : (totalConsumed * price).toFixed(2)}<span className="kpi-unit">€</span></div>
            <div className="kpi-detail">{enableFeedin ? 'Bezugskosten minus Einspeisevergütung' : 'Für diesen Zeitraum'}</div>
            <div className="kpi-detail" style={{ marginTop: '4px', opacity: 0.7 }}>Jahr-Prognose: {projectedYearlyNet.toFixed(0)} €</div>
          </div>
        </div>

        {/* Energy Balance Chart */}
        <div className="chart-card full-width" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="chart-title">Energiebilanz</div>
          <div className="chart-subtitle">Bezug vs Einspeisung — {ranges.find(r => r.key === range)?.label}</div>
          <div className="chart-wrapper tall">
            {loading ? (
              <div className="skeleton" style={{ width: '100%', height: '100%' }} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickFormatter={v => `${v} kWh`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="consumed" name="Bezug" fill="hsl(210, 100%, 60%)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="exported" name="Einspeisung" fill="hsl(38, 92%, 55%)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Power Trend Chart */}
        <div className="chart-card full-width">
          <div className="chart-title">Leistungstrend</div>
          <div className="chart-subtitle">Durchschnittliche und Spitzenleistung — {ranges.find(r => r.key === range)?.label}</div>
          <div className="chart-wrapper tall">
            {loading ? (
              <div className="skeleton" style={{ width: '100%', height: '100%' }} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="avgPowerGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(210, 100%, 60%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(210, 100%, 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickFormatter={v => `${v}W`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="avg_power" name="Durchschnitt" stroke="hsl(210, 100%, 60%)" fill="url(#avgPowerGrad)" strokeWidth={2} dot={showDots ? { r: 3, fill: 'var(--bg-card)' } : false} activeDot={{ r: 5 }} />
                  <Area type="monotone" dataKey="max_power" name="Spitze" stroke="hsl(0, 80%, 60%)" fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" dot={showDots ? { r: 3, fill: 'var(--bg-card)' } : false} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Hourly Profile Chart */}
        <HourlyProfileChart 
          data={profileData} 
          loading={loading} 
          rangeLabel={ranges.find(r => r.key === range)?.label} 
        />

        {/* Weekly Heatmap */}
        <div style={{ marginTop: 'var(--space-6)' }}>
          <WeeklyHeatmap 
            data={heatmapData} 
            loading={loading} 
            rangeLabel={ranges.find(r => r.key === range)?.label} 
          />
        </div>
      </main>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <AuthProvider>
      <AnalyticsContent />
    </AuthProvider>
  );
}
