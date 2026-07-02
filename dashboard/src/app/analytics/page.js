'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, api } from '@/lib/api';
import { AuthProvider } from '@/lib/auth-context';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [historyRes, overviewRes] = await Promise.allSettled([
        api.getHistory(range),
        api.getOverview(),
      ]);

      if (historyRes.status === 'fulfilled') setData(historyRes.value.data || []);
      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value);
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

  const price = overview?.settings?.electricity_price || 0.35;
  const tariff = overview?.settings?.feedin_tariff || 0;

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
          <div className="kpi-card consumption">
            <div className="kpi-label"><span>📊</span> Gesamtverbrauch</div>
            <div className="kpi-value consuming">{totalConsumed.toFixed(1)}<span className="kpi-unit">kWh</span></div>
            <div className="kpi-detail">Kosten: {(totalConsumed * price).toFixed(2)} €</div>
          </div>
          <div className="kpi-card solar">
            <div className="kpi-label"><span>☀️</span> Gesamteinspeisung</div>
            <div className="kpi-value feeding">{totalExported.toFixed(1)}<span className="kpi-unit">kWh</span></div>
            <div className="kpi-detail">Ersparnis: {(totalExported * tariff).toFixed(2)} €</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label"><span>⚡</span> Durchschn. Leistung</div>
            <div className="kpi-value">{Math.round(avgPower)}<span className="kpi-unit">W</span></div>
            <div className="kpi-detail">Spitze: {Math.round(peakPower)} W</div>
          </div>
          <div className="kpi-card success">
            <div className="kpi-label"><span>💰</span> Netto Kosten</div>
            <div className="kpi-value">{((totalConsumed * price) - (totalExported * tariff)).toFixed(2)}<span className="kpi-unit">€</span></div>
            <div className="kpi-detail">Bezugskosten minus Einspeisevergütung</div>
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
                  <Area type="monotone" dataKey="avg_power" name="Durchschnitt" stroke="hsl(210, 100%, 60%)" fill="url(#avgPowerGrad)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="max_power" name="Spitze" stroke="hsl(0, 80%, 60%)" fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
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
