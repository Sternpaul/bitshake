'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { api } from '@/lib/api';

export default function Header() {
  const [health, setHealth] = useState(null);
  const [currentTime, setCurrentTime] = useState('');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Update time every second
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);

    // Check API health
    const checkHealth = async () => {
      try {
        const data = await api.getHealth();
        setHealth(data);
      } catch {
        setHealth({ status: 'error' });
      }
    };
    checkHealth();
    const healthTimer = setInterval(checkHealth, 30000);

    return () => {
      clearInterval(timer);
      clearInterval(healthTimer);
    };
  }, []);

  const isOnline = health?.status === 'ok';
  const mqttConnected = health?.mqtt?.connected;
  const lastReadingAt = health?.mqtt?.last_reading_at;
  
  // Consider the device active if we received a reading in the last 2 minutes
  const deviceActive = lastReadingAt 
    ? (new Date() - new Date(lastReadingAt)) < 120000 
    : false;

  return (
    <header className="header">
      <div className="header-status">
        <span className={`status-dot ${isOnline ? '' : 'offline'}`} />
        <span>
          {isOnline ? 'System Online' : 'Verbinde...'}
          <span className="header-status-detail">
            {mqttConnected !== undefined && (
              <span style={{ marginLeft: '12px', opacity: 0.7 }}>
                {mqttConnected ? '📡 MQTT Verbunden' : '📡 MQTT Offline'}
              </span>
            )}
            {mqttConnected !== undefined && (
              <span style={{ marginLeft: '12px', opacity: 0.7 }}>
                {deviceActive ? '🔌 Bitshake Aktiv' : '🔌 Bitshake wartet...'}
              </span>
            )}
          </span>
        </span>
      </div>

      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {mounted && (
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Theme umschalten"
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-secondary)', 
              cursor: 'pointer', 
              fontSize: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.25rem'
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        )}
        <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
          {currentTime}
        </span>
      </div>
    </header>
  );
}
