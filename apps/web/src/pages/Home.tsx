import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Home() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    const query = new URLSearchParams();
    if (trimmed) query.set("q", trimmed);
    navigate(`/suche${query.size ? `?${query}` : ""}`);
  };

  return (
    <div>
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #5a7a2a 0%, #81ae3d 45%, #528163 100%)",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_-10%,rgba(241,135,75,0.35),transparent_45%)]" />
        <div className="relative max-w-7xl mx-auto px-6 py-24 text-white">
          <p className="font-display text-sm uppercase tracking-[0.2em] text-lime-100/90">
            CREATE Cluster
          </p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl font-bold leading-tight max-w-3xl">
            Match-Making für die Bioökonomie der Kunststoffe
          </h1>
          <p className="mt-6 text-lg text-white/90 max-w-2xl">
            Finden Sie Partner aus Industrie, Entwicklung und Forschung -
            schnell, einfach und passgenau.
          </p>

          <form onSubmit={onSubmit} className="mt-10 max-w-2xl">
            <div className="flex gap-2">
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nach Firma, Branche, Technologie oder Know-how suchen ..."
                className="flex-1 rounded-md px-4 py-3 text-ink placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-white"
              />
              <button
                type="submit"
                className="btn bg-white text-grass-700 hover:bg-lime-50 px-6"
              >
                Suchen
              </button>
            </div>
          </form>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/suche"
              className="btn bg-white text-grass-700 hover:bg-lime-50 px-6 py-3 text-base shadow-card"
            >
              Zur Firmenübersicht
            </Link>
            <Link
              to="/registrieren"
              className="btn bg-transparent border border-white/70 text-white hover:bg-white/10 px-6 py-3 text-base"
            >
              Firma registrieren
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            accent="lime"
            title="Technologieübersicht und Freitextsuche"
            text="Entdecken Sie neue technologische Entwicklungen nach Reifegrad - von Forschung über Entwicklung bis Marktfähig."
          />
          <FeatureCard
            accent="teal"
            title="Sichtbarkeit für Ihr Know-How"
            text="Filtern Sie gezielt nach Branche, Know-how-Schwerpunkten oder nutzen Sie die Suchfunktion."
          />
          <FeatureCard
            accent="orange"
            title="Volle Kontrolle und Vertrauen"
            text="Jedes Unternehmen kann seine Daten selbst verwalten. Profile und Änderungen werden vor der Veröffentlichung vom CREATE-Team gecheckt."
          />
        </div>

        <div className="mt-16 card p-10 text-center">
          <h2 className="font-display text-2xl font-semibold text-grass-700">
            Sind Sie Teil der Bioökonomie der Kunststoffe?
          </h2>
          <p className="mt-2 text-slate-600 max-w-xl mx-auto">
            Registrieren Sie Ihr Unternehmen kostenlos und werden Sie Teil des
            CREATE Cluster-Netzwerks.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <Link to="/suche" className="btn-primary">
              Zur Firmenübersicht
            </Link>
            <Link to="/registrieren" className="btn-accent">
              Firma registrieren
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

const ACCENT_STRIPE: Record<"teal" | "lime" | "orange", string> = {
  teal: "bg-teal-500",
  lime: "bg-lime-500",
  orange: "bg-orange-500",
};

function FeatureCard({
  title,
  text,
  accent,
}: {
  title: string;
  text: string;
  accent: "teal" | "lime" | "orange";
}) {
  return (
    <div className="card p-6 relative overflow-hidden">
      <span
        className={`absolute top-0 left-0 h-1 w-full ${ACCENT_STRIPE[accent]}`}
      />
      <h3 className="font-display text-lg font-semibold text-grass-700">
        {title}
      </h3>
      <p className="mt-2 text-slate-600">{text}</p>
    </div>
  );
}
