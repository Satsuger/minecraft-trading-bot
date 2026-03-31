import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "../../lib/navigation.js";

export function MainNav() {
  return (
    <nav aria-label="Primary" className="main-nav">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          className={({ isActive }) => (isActive ? "nav-button active" : "nav-button")}
          to={item.to}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
