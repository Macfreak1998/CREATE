import { NavLink } from "react-router-dom";

const items = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/firmen", label: "Firmen" },
  { to: "/admin/branchen", label: "Branchen" },
  { to: "/admin/unternehmensgroessen", label: "Größen" },
  { to: "/admin/knowhow", label: "Know-how" },
  { to: "/admin/technologien", label: "Technologien" },
  { to: "/admin/tech-vorschlaege", label: "Tech-Vorschlaege" },
  { to: "/admin/hilfetexte", label: "Hilfetexte" },
  { to: "/admin/mail-templates", label: "Mail-Templates" },
  { to: "/admin/graph", label: "Netzwerkgraph" },
  { to: "/admin/reporting", label: "Reporting" },
  { to: "/admin/tracker", label: "Tracker" },
  { to: "/admin/feedback", label: "Feedback" },
  { to: "/admin/einstellungen", label: "Einstellungen" },
];

export default function AdminNav() {
  return (
    <nav className="flex gap-1 mb-6 border-b border-slate-200 flex-wrap">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            [
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px",
              isActive
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-slate-600 hover:text-slate-900",
            ].join(" ")
          }
        >
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}
