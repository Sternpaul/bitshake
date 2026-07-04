'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, api } from '@/lib/api';
import { AuthProvider } from '@/lib/auth-context';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

function SettingsContent() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Settings state
  const [electricityPrice, setElectricityPrice] = useState('0.35');
  const [enableFeedinTariff, setEnableFeedinTariff] = useState(false);
  const [feedinTariff, setFeedinTariff] = useState('0.00');
  const [currency, setCurrency] = useState('EUR');
  const [refreshInterval, setRefreshInterval] = useState('10');

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // CSV Export
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exporting, setExporting] = useState(false);

  // Device Data
  const [healthData, setHealthData] = useState(null);
  const [activeRawTab, setActiveRawTab] = useState('grid');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    // Set default dates for export
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    setExportFrom(weekAgo);
    setExportTo(today);

    // Load current settings
    const loadSettings = async () => {
      try {
        const result = await api.getSettings();
        const s = result.data;
        if (s.electricity_price) setElectricityPrice(s.electricity_price.value);
        if (s.enable_feedin_tariff) setEnableFeedinTariff(s.enable_feedin_tariff.value === 'true');
        if (s.feedin_tariff) setFeedinTariff(s.feedin_tariff.value);
        if (s.currency) setCurrency(s.currency.value);
        if (s.dashboard_refresh_seconds) setRefreshInterval(s.dashboard_refresh_seconds.value);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();

    // Poll health data for raw payload
    const loadHealth = async () => {
      try {
        const data = await api.getHealth();
        setHealthData(data);
      } catch (err) {
        console.error('Failed to load health data:', err);
      }
    };
    loadHealth();
    const healthInterval = setInterval(loadHealth, 3000);

    return () => clearInterval(healthInterval);
  }, [router]);

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.updateSettings({
        electricity_price: electricityPrice,
        enable_feedin_tariff: enableFeedinTariff ? 'true' : 'false',
        feedin_tariff: feedinTariff,
        currency,
        dashboard_refresh_seconds: refreshInterval,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    setChangingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleExport = async () => {
    if (!exportFrom || !exportTo) return;
    setExporting(true);
    try {
      await api.exportCSV(exportFrom, exportTo);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="app-layout">
      <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header />

      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">Einstellungen</h1>
          <p className="page-subtitle">Konfigurieren Sie Ihre Energietarife, Dashboard-Einstellungen und Ihr Konto</p>
        </div>

        <div className="settings-grid">
          {/* Tariff Settings */}
          <div className="settings-card">
            <div className="settings-card-title">💰 Energietarife</div>

            <div className="form-group">
              <label className="form-label" htmlFor="settings-price">Strompreis</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <input
                  id="settings-price"
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={electricityPrice}
                  onChange={(e) => setElectricityPrice(e.target.value)}
                  style={{ flex: 1 }}
                />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>€/kWh</span>
              </div>
              <div className="form-hint">Aktueller Preis pro bezogener kWh aus dem Netz</div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enableFeedinTariff}
                  onChange={(e) => setEnableFeedinTariff(e.target.checked)}
                  style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--primary)' }}
                />
                Einspeisevergütung aktivieren
              </label>
              <div className="form-hint" style={{ marginTop: 'var(--space-1)' }}>Aktivieren, wenn Sie eine Vergütung für eingespeisten Solarstrom erhalten.</div>
            </div>

            {enableFeedinTariff && (
              <div className="form-group" style={{ paddingLeft: 'var(--space-6)', borderLeft: '2px solid var(--border)' }}>
                <label className="form-label" htmlFor="settings-tariff">Vergütung pro kWh</label>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <input
                    id="settings-tariff"
                    className="form-input"
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={feedinTariff}
                    onChange={(e) => setFeedinTariff(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>€/kWh</span>
                </div>
                <div className="form-hint">Betrag, den Sie pro ins Netz eingespeister kWh erhalten.</div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="settings-currency">Währung</label>
              <select
                id="settings-currency"
                className="form-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CHF">CHF (Fr.)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-6)' }}>
              <button
                className="btn btn-primary"
                onClick={handleSaveSettings}
                disabled={saving}
              >
                {saving ? '⏳ Speichere...' : '💾 Einstellungen speichern'}
              </button>
              {saved && <span className="settings-saved">✅ Gespeichert!</span>}
            </div>
          </div>

          {/* Dashboard Settings */}
          <div className="settings-card">
            <div className="settings-card-title">⚙️ Dashboard-Einstellungen</div>

            <div className="form-group">
              <label className="form-label" htmlFor="settings-refresh">Auto-Refresh Intervall</label>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <input
                  id="settings-refresh"
                  className="form-input"
                  type="number"
                  min="5"
                  max="300"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(e.target.value)}
                  style={{ flex: 1 }}
                />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>seconds</span>
              </div>
              <div className="form-hint">Wie oft das Dashboard Daten aktualisiert (5–300 Sekunden)</div>
            </div>

            <div style={{ marginTop: 'var(--space-8)' }}>
              <div className="settings-card-title" style={{ fontSize: '1rem' }}>📦 Daten exportieren</div>
              <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="export-from">Von</label>
                  <input
                    id="export-from"
                    className="form-input"
                    type="date"
                    value={exportFrom}
                    onChange={(e) => setExportFrom(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="export-to">Bis</label>
                  <input
                    id="export-to"
                    className="form-input"
                    type="date"
                    value={exportTo}
                    onChange={(e) => setExportTo(e.target.value)}
                  />
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={handleExport}
                  disabled={exporting}
                >
                  {exporting ? '⏳ Exportiere...' : '📥 CSV herunterladen'}
                </button>
              </div>
              <div className="form-hint" style={{ marginTop: 'var(--space-2)' }}>
                Exportieren Sie Rohdaten als CSV für den ausgewählten Zeitraum
              </div>
            </div>
          </div>

          {/* Password Change */}
          <div className="settings-card">
            <div className="settings-card-title">🔐 Passwort ändern</div>

            {passwordError && <div className="login-error" style={{ marginBottom: 'var(--space-4)' }}>{passwordError}</div>}
            {passwordSuccess && (
              <div style={{
                background: 'var(--success-bg)',
                border: '1px solid var(--success)',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-3) var(--space-4)',
                color: 'var(--success)',
                fontSize: '0.85rem',
                marginBottom: 'var(--space-4)',
              }}>
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label className="form-label" htmlFor="current-password">Aktuelles Passwort</label>
                <input
                  id="current-password"
                  className="form-input"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="new-password">Neues Passwort</label>
                <input
                  id="new-password"
                  className="form-input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <div className="form-hint">Mindestens 8 Zeichen</div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="confirm-password">Neues Passwort bestätigen</label>
                <input
                  id="confirm-password"
                  className="form-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={changingPassword}
              >
                {changingPassword ? '⏳ Ändere...' : '🔑 Passwort ändern'}
              </button>
            </form>
          </div>

          {/* Device Diagnostics */}
          <div className="settings-card" style={{ gridColumn: '1 / -1' }}>
            <div className="settings-card-title">📡 Gerätediagnose (Rohdaten)</div>
            <div className="form-hint" style={{ marginBottom: 'var(--space-4)' }}>
              Hier sehen Sie die ungefilterten Live-Daten, die Ihr Bitshake/Tasmota-Lesekopf und der Marstek-Wechselrichter an den Server senden.
            </div>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <button 
                onClick={() => setActiveRawTab('grid')}
                style={{
                  padding: '4px 12px',
                  background: activeRawTab === 'grid' ? 'var(--primary)' : 'var(--surface-sunken)',
                  color: activeRawTab === 'grid' ? 'white' : 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Stromzähler (Grid)
              </button>
              <button 
                onClick={() => setActiveRawTab('solar')}
                style={{
                  padding: '4px 12px',
                  background: activeRawTab === 'solar' ? 'var(--solar)' : 'var(--surface-sunken)',
                  color: activeRawTab === 'solar' ? 'white' : 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Solaranlage (Marstek)
              </button>
            </div>
            
            <div style={{
              background: 'var(--surface-sunken)',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              whiteSpace: 'pre-wrap',
              overflowX: 'auto',
              color: 'var(--text-secondary)'
            }}>
              {activeRawTab === 'grid' 
                ? (healthData?.mqtt?.last_raw_payload_grid 
                    ? JSON.stringify(healthData.mqtt.last_raw_payload_grid, null, 2) 
                    : 'Warte auf Grid-Daten...')
                : (healthData?.mqtt?.last_raw_payload_solar 
                    ? JSON.stringify(healthData.mqtt.last_raw_payload_solar, null, 2) 
                    : 'Warte auf Solar-Daten...')}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthProvider>
      <SettingsContent />
    </AuthProvider>
  );
}
