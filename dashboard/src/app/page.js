'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, api } from '@/lib/api';
import { AuthProvider } from '@/lib/auth-context';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import KPICard from '@/components/cards/KPICard';
import LivePowerChart from '@/components/charts/LivePowerChart';
import LiveSolarChart from '@/components/charts/LiveSolarChart';
import DailyPowerCurve from '@/components/charts/DailyPowerCurve';
import WeeklyEnergyChart from '@/components/charts/WeeklyEnergyChart';
import MonthlyTrendChart from '@/components/charts/MonthlyTrendChart';

function DashboardContent() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [recentData, setRecentData] = useState([]);
  const [todayData, setTodayData] = useState([]);
  const [weekData, setWeekData] = useState([]);
  const [monthData, setMonthData] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const [overviewRes, recentRes, todayRes, weekRes, monthRes] = await Promise.allSettled([
        api.getOverview(),
        api.getRecent(30),
        api.getHistory('24h'),
        api.getHistory('7d'),
        api.getHistory('30d'),
      ]);

      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value);
      if (recentRes.status === 'fulfilled') setRecentData(recentRes.value.data || []);
      if (todayRes.status === 'fulfilled') setTodayData(todayRes.value.data || []);
      if (weekRes.status === 'fulfilled') setWeekData(weekRes.value.data || []);
      if (monthRes.status === 'fulfilled') setMonthData(monthRes.value.data || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    fetchData();

    // Use the refresh interval from settings, default to 10 seconds
    const intervalSeconds = overview?.settings?.dashboard_refresh_seconds 
      ? parseInt(overview.settings.dashboard_refresh_seconds, 10) 
      : 10;

    const interval = setInterval(fetchData, intervalSeconds * 1000);
    return () => clearInterval(interval);
  }, [router, fetchData, overview?.settings?.dashboard_refresh_seconds]);

  const current = overview?.current;
  const today = overview?.today;
  const settings = overview?.settings;

  const formatNumber = (num, decimals = 1) => {
    if (num === null || num === undefined) return '—';
    return Number(num).toFixed(decimals);
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    if (amount === null || amount === undefined) return '—';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="app-layout">
      <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
        ☰
      </button>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header />

      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">Übersicht</h1>
          <p className="page-subtitle">
            Echtzeit-Energieüberwachung — Bitshake Smart Meter Reader Air
          </p>
        </div>

        {/* KPI Cards */}
        <div className="kpi-grid">
          <KPICard
            icon="⚡"
            label="Aktuelle Leistung"
            value={current ? `${Math.abs(Math.round(current.power))}` : '—'}
            unit="W"
            variant={current?.power < 0 ? 'solar' : 'consumption'}
            detail={current ? (
              <span style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span>{current.power < 0 ? '↑ Einspeisung ins Netz' : '↓ Bezug aus dem Netz'}</span>
                {current.solar_power > 0 && (
                  <span style={{ color: 'var(--solar)' }}>☀️ {Math.round(current.solar_power)} W Solar</span>
                )}
              </span>
            ) : 'Warte auf Daten...'}
            loading={loading}
          />
          <KPICard
            icon="📊"
            label="Heutiger Verbrauch"
            value={formatNumber(today?.consumed_kwh)}
            unit="kWh"
            variant="consumption"
            detail={`Spitze: ${formatNumber(today?.peak_power, 0)} W`}
            loading={loading}
          />
          <KPICard
            icon="☀️"
            label="Heutige Einspeisung"
            value={formatNumber(today?.exported_kwh)}
            unit="kWh"
            variant="solar"
            detail="Ins Netz eingespeist"
            loading={loading}
          />
          <KPICard
            icon="⚖️"
            label="Heutige Netzbilanz"
            value={today?.net_balance_kwh > 0 ? `+${formatNumber(today.net_balance_kwh)}` : formatNumber(today?.net_balance_kwh)}
            unit="kWh"
            variant={today?.net_balance_kwh > 0 ? 'solar' : 'consumption'}
            detail={today?.net_balance_kwh > 0 ? 'Netto-Einspeiser' : 'Netto-Bezieher'}
            loading={loading}
          />
          <KPICard
            icon="💰"
            label="Heutige Kosten"
            value={formatCurrency(today?.cost, settings?.currency)}
            variant="cost"
            detail={`@ ${formatNumber(settings?.electricity_price, 2)} €/kWh`}
            loading={loading}
          />
          {settings?.enable_feedin_tariff === 'true' && (
            <KPICard
              icon="💵"
              label="Heutige Ersparnis"
              value={formatCurrency(today?.earnings, settings?.currency)}
              variant="solar"
              detail={`@ ${formatNumber(settings?.feedin_tariff, 2)} €/kWh`}
              loading={loading}
            />
          )}
        </div>

        {/* Charts */}
        <LivePowerChart data={recentData} loading={loading} />
        <LiveSolarChart data={recentData} loading={loading} />

        <div className="chart-grid" style={{ marginTop: 'var(--space-6)' }}>
          <DailyPowerCurve data={todayData} loading={loading} />
          <WeeklyEnergyChart data={weekData} loading={loading} />
        </div>

        <div className="chart-grid">
          <MonthlyTrendChart data={monthData} loading={loading} />
        </div>

        {/* No data state */}
        {!loading && !current && (
          <div className="empty-state" style={{ marginTop: 'var(--space-8)' }}>
            <div className="empty-state-icon">📡</div>
            <div className="empty-state-title">Warte auf Daten</div>
            <div className="empty-state-text">
              Dein Bitshake Smart Meter Reader hat noch keine Daten gesendet.
              Bitte stelle sicher, dass MQTT korrekt konfiguriert und das Gerät online ist.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}
