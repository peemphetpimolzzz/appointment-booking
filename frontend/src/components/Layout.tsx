import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/book', label: 'Book' },
  { to: '/lookup', label: 'My Booking' },
  { to: '/admin', label: 'Admin' },
];

export function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-group">
          <div className="brand-logo">BE</div>
          <div>
            <div className="brand">
              Book<span>Easy</span> · SlotWise
            </div>
            <div className="brand-sub">Omnichannel Appointment &amp; Schedule Console</div>
          </div>
        </div>

        <nav>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="topbar-meta">
          <span className="badge badge-ok">● PostgreSQL GiST Guard</span>
          <span className="badge badge-neutral">Asia/Bangkok (UTC+7)</span>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
