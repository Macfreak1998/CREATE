import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { AdminStats } from "@b2b/shared";
import { api } from "../../lib/api.js";
import AdminNav from "./AdminNav.js";

export default function AdminDashboard() {
  const stats = useQuery<AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: () => api.get<AdminStats>("/api/admin/stats"),
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-semibold mb-6">Admin</h1>
      <AdminNav />

      {stats.isLoading ? (
        <div className="text-slate-500">Laden ...</div>
      ) : stats.isError || !stats.data ? (
        <div className="text-red-600">Statistik konnte nicht geladen werden.</div>
      ) : (
        <div className="grid md:grid-cols-5 gap-4">
          <Metric
            label="Firmen gesamt"
            value={stats.data.total_companies}
            href="/admin/firmen"
          />
          <Metric
            label="Entwürfe"
            value={stats.data.companies_by_status.draft ?? 0}
            href="/admin/firmen?status=draft"
            accent
          />
          <Metric
            label="In Prüfung"
            value={stats.data.companies_by_status.pending ?? 0}
            href="/admin/firmen?status=pending"
          />
          <Metric
            label="Freigeschaltet"
            value={stats.data.companies_by_status.approved ?? 0}
            href="/admin/firmen?status=approved"
          />
          <Metric label="Nutzer gesamt" value={stats.data.total_users} />
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: number;
  href?: string;
  accent?: boolean;
}) {
  const content = (
    <div className={`card p-5 ${accent ? "border-teal-300" : ""}`}>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
    </div>
  );
  if (href) return <Link to={href}>{content}</Link>;
  return content;
}
