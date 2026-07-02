'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export default function Header() {
  const [health, setHealth] = useState(null);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
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

  return (
    <header className="header">
      <div className="header-status">
        <span className={`status-dot ${isOnline ? '' : 'offline'}`} />
        <span>
          {isOnline ? 'System Online' : 'Connecting...'}
          {mqttConnected !== undefined && (
            <span style={{ marginLeft: '12px', opacity: 0.7 }}>
              {mqttConnected ? '📡 MQTT Connected' : '📡 MQTT Offline'}
            </span>
          )}
        </span>
      </div>

      <div className="header-actions">
        <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
          {currentTime}
        </span>
      </div>
    </header>
  );
}
