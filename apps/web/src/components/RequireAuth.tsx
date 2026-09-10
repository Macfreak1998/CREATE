import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { UserRole } from "@b2b/shared";
import { useMe } from "../hooks/useAuth.js";

export default function RequireAuth({ role }: { role?: UserRole }) {
  const { data: me, isLoading } = useMe();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-slate-500">Laden ...</div>
    );
  }
  if (!me?.user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (role && me.user.role !== role) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
