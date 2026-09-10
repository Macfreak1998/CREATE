import { useQuery } from "@tanstack/react-query";
import type { AdminStats } from "@b2b/shared";
import { api } from "../../lib/api.js";
import AdminNav from "./AdminNav.js";
import { SHOW_MACHINES } from "../../config/features.js";

export default function AdminReporting() {
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
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="font-semibold mb-4">Firmen nach Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(stats.data.companies_by_status).map(([status, count]) => (
                <div key={status} className="border border-slate-200 rounded-md p-4">
                  <div className="text-sm text-slate-500">{labelForStatus(status)}</div>
                  <div className="text-2xl font-semibold">{count}</div>
                </div>
              ))}
            </div>
          </section>

          <div className="grid md:grid-cols-2 gap-6">
            <RankingCard title="Top Technologien" items={stats.data.top_technologies} />
            {SHOW_MACHINES && (
              <RankingCard title="Top Maschinen" items={stats.data.top_machines} />
            )}
            <RankingCard title="Top Branchen" items={stats.data.top_industries} />
            <RankingCard title="Top Know-how" items={stats.data.top_knowhows} />
          </div>

          <section className="card p-6">
            <h2 className="font-semibold mb-4">Registrierungen pro Woche (letzte 12 Wochen)</h2>
            {stats.data.registrations_per_week.length === 0 ? (
              <p className="text-slate-500 text-sm">Noch keine Daten.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {stats.data.registrations_per_week.map((row) => (
                  <li key={row.week} className="flex gap-3 items-center">
                    <span className="w-24 text-slate-500">KW {row.week}</span>
                    <span className="flex-1 h-2 bg-slate-100 rounded">
                      <span
                        className="h-2 bg-teal-500 rounded block"
                        style={{
                          width: `${Math.min(
                            100,
                            (row.count / maxCount(stats.data.registrations_per_week)) * 100
                          )}%`,
                        }}
                      />
                    </span>
                    <span className="w-10 text-right font-medium">{row.count}</span>
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

function RankingCard({
  title,
  items,
}: {
  title: string;
  items: { id: number; name: string; count: number }[];
}) {
  return (
    <section className="card p-6">
      <h2 className="font-semibold mb-4">{title}</h2>
      {items.length === 0 ? (
        <p className="text-slate-500 text-sm">Keine Daten.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex justify-between">
              <span>{item.name}</span>
              <span className="font-medium tabular-nums">{item.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function labelForStatus(status: string): string {
  switch (status) {
    case "draft":
      return "Entwürfe";
    case "pending":
      return "In Prüfung";
    case "approved":
      return "Freigeschaltet";
    case "rejected":
      return "Abgelehnt";
    case "suspended":
      return "Gesperrt";
    default:
      return status;
  }
}

function maxCount(rows: { count: number }[]): number {
  return rows.reduce((m, r) => (r.count > m ? r.count : m), 1);
}
