import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useLogout, useMe } from "../hooks/useAuth.js";
import { useUnsavedChanges } from "../hooks/useUnsavedChangesPrompt.js";
import BrandMark from "./BrandMark.js";
import AnalyticsTracker from "./AnalyticsTracker.js";
import FeedbackPrompt from "./FeedbackPrompt.js";
import { SHOW_NETWORK_GRAPH } from "../config/features.js";

export default function Layout() {
  const { data: me } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const { confirmNavigation } = useUnsavedChanges();

  const handleLogout = async () => {
    if (!confirmNavigation()) return;
    await logout.mutateAsync();
    navigate("/", { replace: true });
  };

  const guardClick = (e: React.MouseEvent) => {
    if (!confirmNavigation()) {
      e.preventDefault();
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white/95 backdrop-blur border-b border-line sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3" onClick={guardClick}>
            <BrandMark />
            <div>
              <div className="font-display text-xl font-bold text-grass-700 leading-none">
                CREATE-Technologieplattform
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Match-Making für die Bioökonomie der Kunststoffe
              </div>
            </div>
          </Link>
          <nav className="flex items-center gap-1">
            <a
              href="https://www.create-cluster.de"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-md text-sm font-semibold font-display text-slate-700 hover:bg-slate-100"
            >
              Zur Projektübersicht
            </a>
            <NavLinkItem to="/suche" onClick={guardClick}>
              Firmen suchen
            </NavLinkItem>
            {SHOW_NETWORK_GRAPH && (
              <NavLinkItem to="/netzwerk" onClick={guardClick}>
                Netzwerk
              </NavLinkItem>
            )}

            {me?.user ? (
              <>
                {me.company && (
                  <NavLinkItem to="/profil" onClick={guardClick}>
                    Profil
                  </NavLinkItem>
                )}
                {me.user.role === "admin" && (
                  <NavLinkItem to="/admin" onClick={guardClick}>
                    Admin
                  </NavLinkItem>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn-secondary ml-2"
                >
                  Abmelden
                </button>
              </>
            ) : (
              <>
                <NavLinkItem to="/login" onClick={guardClick}>
                  Login
                </NavLinkItem>
                <Link
                  to="/registrieren"
                  className="btn-accent ml-2"
                  onClick={guardClick}
                >
                  Registrieren
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <AnalyticsTracker />
      <FeedbackPrompt />

      <footer className="border-t border-line bg-white mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6 text-sm text-slate-500 flex flex-col items-center gap-3">
          <p>
            <a href="https://www.skz.de" target="_blank" rel="noopener noreferrer">
              &copy; {new Date().getFullYear()} SKZ
            </a>
          </p>
          <div className="flex gap-4 items-center flex-wrap justify-center">
            <Link to="/feedback" className="hover:text-slate-700">
              Feedback geben
            </Link>
            <a href="https://www.create-cluster.de/impressum" target="_blank" rel="noopener noreferrer">
              Impressum
            </a>
            <a href="https://www.create-cluster.de/datenschutz" target="_blank" rel="noopener noreferrer">
              Datenschutz
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavLinkItem({
  to,
  children,
  onClick,
}: {
  to: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        [
          "px-3 py-2 rounded-md text-sm font-semibold font-display",
          isActive ? "text-teal-600 bg-teal-50" : "text-slate-700 hover:bg-slate-100",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  );
}
