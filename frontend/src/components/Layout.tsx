import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/book', label: 'Book' },
  { to: '/lookup', label: 'My Booking' },
  { to: '/admin', label: 'Admin' },
];

export function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          Book<span>Easy</span>
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
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
