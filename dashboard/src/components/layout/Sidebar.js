'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const navItems = [
  { href: '/', icon: '📊', label: 'Übersicht' },
  { href: '/analytics', icon: '📈', label: 'Analysen' },
  { href: '/settings', icon: '⚙️', label: 'Einstellungen' },
];

export default function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
      />

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-header">
          <div className="sidebar-logo">⚡</div>
          <div>
            <div className="sidebar-brand">Bitshake</div>
            <div className="sidebar-brand-sub">Energiemonitor</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${pathname === item.href ? 'active' : ''}`}
              onClick={onClose}
            >
              <span className="nav-link-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-3)' }}>
            Angemeldet als <strong style={{ color: 'var(--text-secondary)' }}>{user?.username || 'admin'}</strong>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={logout} style={{ width: '100%' }}>
            🚪 Abmelden
          </button>
        </div>
      </aside>
    </>
  );
}
