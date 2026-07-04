'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', icon: '📊', label: 'Übersicht' },
  { href: '/analytics', icon: '📈', label: 'Analysen' },
  { href: '/settings', icon: '⚙️', label: 'Einstellungen' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`bottom-nav-item ${pathname === item.href ? 'active' : ''}`}
        >
          <span className="bottom-nav-icon">{item.icon}</span>
          <span className="bottom-nav-label">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
