import { NavLink } from 'react-router-dom'

const ITEMS = [
  { to: '/', icon: '💵', label: 'Gastos', end: true },
  { to: '/calendario', icon: '📅', label: 'Calendario' },
  { to: '/reservas', icon: '🛏️', label: 'Reservas' },
  { to: '/resumen', icon: '📊', label: 'Resumen' },
]

export default function Nav() {
  return (
    <nav className="bottom-nav">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
        >
          <span className="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
