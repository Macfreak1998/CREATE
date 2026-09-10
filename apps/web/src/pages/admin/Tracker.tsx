import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { AnalyticsStats } from "@b2b/shared";
import { api } from "../../lib/api.js";
import AdminNav from "./AdminNav.js";

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function AdminTracker() {
  const stats = useQuery<AnalyticsStats>({
    queryKey: ["admin", "analytics"],
    queryFn: () => api.get<AnalyticsStats>("/api/admin/analytics"),
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-semibold mb-6">Admin</h1>
      <AdminNav />

      {stats.isLoading ? (
        <div className="text-slate-500">Laden ...</div>
      ) : stats.isError || !stats.data ? (
        <div className="text-red-600">Tracker-Daten konnten nicht geladen werden.</div>
      ) : (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="card p-6">
              <div className="text-sm text-slate-500">Gesamtaufrufe</div>
              <div className="text-3xl font-semibold mt-1">
                {stats.data.total_pageviews.toLocaleString("de-DE")}
              </div>
            </div>
            <div className="card p-6">
              <div className="text-sm text-slate-500">Verweildauer gesamt</div>
              <div className="text-3xl font-semibold mt-1">
                {formatDuration(stats.data.total_dwell_seconds)}
              </div>
            </div>
            <div className="card p-6">
              <div className="text-sm text-slate-500">Ø Verweildauer / Meldetakt</div>
              <div className="text-3xl font-semibold mt-1">
                {formatDuration(stats.data.avg_dwell_seconds)}
              </div>
            </div>
          </div>

          <section className="card p-6">
            <h2 className="font-semibold mb-4">Meistgeklickte Firmen</h2>
            {stats.data.top_companies.length === 0 ? (
              <p className="text-sm text-slate-500">Noch keine Firmendetail-Aufrufe.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {stats.data.top_companies.map((c, index) => (
                  <li
                    key={c.company_id}
                    className="py-3 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <span className="text-slate-400 text-sm mr-2">
                        {index + 1}.
                      </span>
                      <Link
                        to={`/firma/${c.slug}`}
                        className="font-medium text-teal-700 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </div>
                    <span className="font-mono text-sm tabular-nums">
                      {c.views.toLocaleString("de-DE")} Aufrufe
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
