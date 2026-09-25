import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, FileText, Ticket, Users, Image, Settings, LogOut, Tag, LayoutGrid } from 'lucide-react';
import { useAuth } from '../../lib/auth.jsx';
import { T, Logo } from '../../shared';
import ThemeToggle from '../ThemeToggle';

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, roles: ['OWNER', 'SALES', 'EDITOR', 'FINANCE'], end: true },
  { to: '/admin/bookings', label: 'Bookings & Calendar', icon: CalendarDays, roles: ['OWNER', 'SALES'] },
  { to: '/admin/quotes', label: 'Quotes', icon: FileText, roles: ['OWNER', 'SALES', 'FINANCE'] },
  { to: '/admin/services', label: 'Services & Pricing', icon: Tag, roles: ['OWNER', 'FINANCE'] },
  { to: '/admin/events', label: 'Events & Ticketing', icon: Ticket, roles: ['OWNER', 'SALES'] },
  { to: '/admin/venues', label: 'Venue Layouts', icon: LayoutGrid, roles: ['OWNER', 'SALES'] },
  { to: '/admin/clients', label: 'Clients', icon: Users, roles: ['OWNER', 'SALES'] },
  { to: '/admin/content', label: 'Content', icon: Image, roles: ['OWNER', 'EDITOR'] },
  { to: '/admin/settings', label: 'Settings', icon: Settings, roles: ['OWNER'] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const items = NAV.filter((item) => item.roles.includes(user.role));

  return (
    <aside className="w-64 shrink-0 flex flex-col h-screen sticky top-0" style={{ background: T.surface, borderRight: `1px solid ${T.line}` }}>
      <div className="px-6 py-6" style={{ borderBottom: `1px solid ${T.line}` }}>
        <Logo size="sm" />
        <div className="text-[10px] tracking-[.2em] uppercase mt-2" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>Admin</div>
      </div>

      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${isActive ? '' : 'hover:bg-[var(--wash)]'}`
            }
            style={({ isActive }) => ({
              background: isActive ? 'rgba(240,54,42,.12)' : 'transparent',
              color: isActive ? T.stream : T.muted,
            })}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-5" style={{ borderTop: `1px solid ${T.line}` }}>
        <div className="text-xs mb-3" style={{ color: T.muted }}>
          <div style={{ color: T.text }}>{user.name}</div>
          <div className="text-[10px] tracking-[.15em] uppercase mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{user.role}</div>
        </div>
        <ThemeToggle withLabel />
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-[var(--wash)]"
          style={{ color: T.muted }}
        >
          <LogOut size={14} /> Log out
        </button>
      </div>
    </aside>
  );
}
