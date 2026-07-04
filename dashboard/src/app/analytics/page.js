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
import KPICard from '@/components/cards/KPICard';

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
    generated: Number(d.generated_kwh || 0),
    generated_estimated: Number(d.generated_estimated_kwh || 0),
    avg_power: Number(d.avg_power || 0),
    max_power: Number(d.max_power || 0),
  }));

  const totalConsumed = chartData.reduce((sum, d) => sum + d.consumed, 0);
  const totalExported = chartData.reduce((sum, d) => sum + d.exported, 0);
  const totalGeneratedRaw = chartData.reduce((sum, d) => sum + d.generated, 0);
  const totalGeneratedEst = chartData.reduce((sum, d) => sum + d.generated_estimated, 0);
  const totalGenerated = totalGeneratedRaw + totalGeneratedEst;
  const selfConsumptionPct = totalGenerated > 0 ? ((totalGenerated - totalExported) / totalGenerated) * 100 : 0;
  
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
  const avgDailyGenerated = totalGenerated / actualDays;
  
  const projectedYearlyConsumed = avgDailyConsumed * 365;
  const projectedYearlyExported = avgDailyExported * 365;
  const projectedYearlyGenerated = avgDailyGenerated * 365;
  const projectedYearlyCost = projectedYearlyConsumed * price;
  const projectedYearlyEarnings = projectedYearlyExported * tariff;
  const projectedYearlyNet = enableFeedin ? projectedYearlyCost - projectedYearlyEarnings : projectedYearlyCost;

  // Removed TrendBadge component as it is now integrated directly into KPICard

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
          <KPICard
            icon="📊"
            label="Gesamtverbrauch"
            value={totalConsumed.toFixed(1)}
            unit="kWh"
            variant="consumption"
            trend={trends?.trend_consumed_pct}
            trendInvert={false}
            detail={
              <>
                <div>Kosten im Zeitraum: {(totalConsumed * price).toFixed(2)} €</div>
                <div style={{ marginTop: '4px', opacity: 0.7 }}>Jahr-Prognose: {projectedYearlyConsumed.toFixed(0)} kWh</div>
              </>
            }
          />
          
          <KPICard
            icon="☀️"
            label="Gesamteinspeisung"
            value={totalExported.toFixed(1)}
            unit="kWh"
            variant="solar"
            trend={trends?.trend_exported_pct}
            trendInvert={true}
            detail={
              <>
                <div>{enableFeedin ? `Ersparnis im Zeitraum: ${(totalExported * tariff).toFixed(2)} €` : 'Einspeisevergütung deaktiviert'}</div>
                <div style={{ marginTop: '4px', opacity: 0.7 }}>Jahr-Prognose: {projectedYearlyExported.toFixed(0)} kWh</div>
              </>
            }
          />
          
          <KPICard
            icon="⚡"
            label="Solar (Roh)"
            value={totalGeneratedRaw.toFixed(1)}
            unit="kWh"
            variant="solar"
            trend={trends?.trend_generated_pct}
            trendInvert={true}
            detail={
              <>
                <div>+ {totalGeneratedEst.toFixed(1)} kWh Geschätzt = {totalGenerated.toFixed(1)} kWh Gesamt</div>
                <div style={{ marginTop: '4px', opacity: 0.7 }}>Jahr-Prognose: {projectedYearlyGenerated.toFixed(0)} kWh</div>
              </>
            }
          />
          
          <KPICard
            icon="♻️"
            label="Eigenverbrauch"
            value={Math.max(0, Math.min(100, selfConsumptionPct)).toFixed(1)}
            unit="%"
            variant="consumption"
            detail={
              <>
                <div>Selbst genutzter Solarstrom</div>
                <div style={{ marginTop: '4px', opacity: 0.7 }}>{(totalGenerated - totalExported).toFixed(1)} kWh vermiedener Netzbezug</div>
              </>
            }
          />
          
          <KPICard
            icon="⚡"
            label="Leistung"
            value={Math.round(avgPower)}
            unit="W Ø"
            variant="consumption"
            detail={
              <>
                <div>Spitze: {Math.round(peakPower)} W</div>
                <div style={{ marginTop: '4px', opacity: 0.7 }}>Standby: {baseLoadW > 0 ? `${Math.round(baseLoadW)} W` : 'Berechne...'}</div>
              </>
            }
          />
          
          <KPICard
            icon="💰"
            label={enableFeedin ? 'Netto Kosten' : 'Stromkosten'}
            value={enableFeedin ? ((totalConsumed * price) - (totalExported * tariff)).toFixed(2) : (totalConsumed * price).toFixed(2)}
            unit="€"
            variant="cost"
            detail={
              <>
                <div>{enableFeedin ? 'Bezugskosten minus Einspeisevergütung' : 'Für diesen Zeitraum'}</div>
                <div style={{ marginTop: '4px', opacity: 0.7 }}>Jahr-Prognose: {projectedYearlyNet.toFixed(0)} €</div>
              </>
            }
          />
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
        
        {/* Solar Generation Chart */}
        <div className="chart-card full-width" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="chart-title">Solarproduktion</div>
          <div className="chart-subtitle">Geschätzte Erzeugung — {ranges.find(r => r.key === range)?.label}</div>
          <div className="chart-wrapper tall">
            {loading ? (
              <div className="skeleton" style={{ width: '100%', height: '100%' }} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <pattern id="striped-bar" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <rect width="2" height="4" fill="hsl(38, 92%, 70%)" fillOpacity="0.4" />
                      <rect x="2" width="2" height="4" fill="transparent" />
                    </pattern>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="rgba(255,255,255,0.2)" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickFormatter={v => `${v} kWh`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="generated" name="Solarstrom (Roh)" fill="var(--solar)" stackId="solar" maxBarSize={50} />
                  <Bar dataKey="generated_estimated" name="Solarstrom (Geschätzt)" fill="url(#striped-bar)" stroke="hsl(38, 92%, 70%)" strokeWidth={1} stackId="solar" radius={[4, 4, 0, 0]} maxBarSize={50} />
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
