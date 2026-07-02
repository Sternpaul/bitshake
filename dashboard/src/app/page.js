'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, api } from '@/lib/api';
import { AuthProvider } from '@/lib/auth-context';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import KPICard from '@/components/cards/KPICard';
import LivePowerChart from '@/components/charts/LivePowerChart';
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

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [router, fetchData]);

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
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Real-time energy monitoring — Bitshake Smart Meter Reader Air
          </p>
        </div>

        {/* KPI Cards */}
        <div className="kpi-grid">
          <KPICard
            icon="⚡"
            label="Current Power"
            value={current ? `${Math.abs(Math.round(current.power))}` : '—'}
            unit="W"
            variant={current?.power < 0 ? 'solar' : 'consumption'}
            detail={current ? (current.power < 0 ? '↑ Feeding to grid' : '↓ Consuming from grid') : 'Waiting for data...'}
            loading={loading}
          />
          <KPICard
            icon="📊"
            label="Today's Consumption"
            value={formatNumber(today?.consumed_kwh)}
            unit="kWh"
            variant="consumption"
            detail={`Peak: ${formatNumber(today?.peak_power, 0)} W`}
            loading={loading}
          />
          <KPICard
            icon="☀️"
            label="Today's Feed-in"
            value={formatNumber(today?.exported_kwh)}
            unit="kWh"
            variant="solar"
            detail="Exported to grid"
            loading={loading}
          />
          <KPICard
            icon="🔋"
            label="Self-Consumption"
            value={today ? `${Math.round((today.self_consumption_rate || 0) * 100)}` : '—'}
            unit="%"
            variant="success"
            detail="Energy used vs total"
            loading={loading}
          />
          <KPICard
            icon="💰"
            label="Today's Cost"
            value={formatCurrency(today?.cost, settings?.currency)}
            variant="cost"
            detail={`@ ${formatNumber(settings?.electricity_price, 2)} €/kWh`}
            loading={loading}
          />
          <KPICard
            icon="💵"
            label="Today's Earnings"
            value={formatCurrency(today?.earnings, settings?.currency)}
            variant="solar"
            detail={settings?.feedin_tariff > 0 ? `@ ${formatNumber(settings?.feedin_tariff, 2)} €/kWh` : 'No feed-in tariff set'}
            loading={loading}
          />
        </div>

        {/* Charts */}
        <LivePowerChart data={recentData} loading={loading} />

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
            <div className="empty-state-title">Waiting for Data</div>
            <div className="empty-state-text">
              Your Bitshake Smart Meter Reader hasn&apos;t sent any data yet.
              Make sure MQTT is configured correctly and the device is online.
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
