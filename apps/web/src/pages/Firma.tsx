import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { CompanyDetail } from "@b2b/shared";
import { api, ApiError } from "../lib/api.js";
import CompanyLogo from "../components/CompanyLogo.js";
import { TrlBadge } from "./Suche.js";
import { SHOW_MACHINES } from "../config/features.js";

export default function Firma() {
  const { slug } = useParams<{ slug: string }>();
  const query = useQuery<CompanyDetail>({
    queryKey: ["company", slug],
    queryFn: () => api.get<CompanyDetail>(`/api/companies/${slug}`),
    enabled: !!slug,
    retry: false,
  });

  if (query.isLoading) {
    return <div className="max-w-4xl mx-auto px-4 py-12 text-slate-500">Laden ...</div>;
  }

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">
          {notFound ? "Firma nicht gefunden" : "Fehler"}
        </h1>
        <p className="mt-2 text-slate-600">
          {notFound
            ? "Diese Firma existiert nicht oder ist nicht öffentlich."
            : "Die Firma konnte nicht geladen werden."}
        </p>
        <Link to="/suche" className="btn-primary mt-6 inline-flex">
          Zur Suche
        </Link>
      </div>
    );
  }

  const firma = query.data!;
  const displayName = firma.display_name?.trim() || firma.name;
  const mailtoSubject = encodeURIComponent(
    `Anfrage über das CREATE Match-Making an ${displayName}`
  );
  const mailtoHref = `mailto:${firma.contact_email}?subject=${mailtoSubject}`;
  const addressLine = [firma.postal_code, firma.city]
    .filter(Boolean)
    .join(" ");
  const hasAddress =
    firma.street || addressLine || firma.country;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div className="card p-6">
        <div className="flex gap-6 items-start">
          <CompanyLogo src={firma.logo_url} name={displayName} size="xl" rounded="lg" />
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{displayName}</h1>
            {firma.display_name && firma.display_name.trim() !== firma.name && (
              <p className="text-sm text-slate-500 mt-1">
                Offizieller Name: {firma.name}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2 items-center">
              {firma.size && (
                <span className="badge bg-slate-100 text-slate-700 border border-slate-200">
                  {firma.size.name}
                </span>
              )}
              {firma.industries.map((i) => (
                <span
                  key={i.id}
                  className="badge bg-lime-50 text-lime-800 border border-lime-200"
                >
                  {i.name}
                </span>
              ))}
            </div>
            {firma.website_url && (
              <p className="mt-2 text-sm">
                <a
                  href={firma.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-700 hover:underline"
                >
                  {firma.website_url}
                </a>
              </p>
            )}
            {firma.description && (
              <p className="mt-3 text-slate-700 whitespace-pre-line leading-relaxed">
                {firma.description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 border-t border-slate-200 pt-6 grid md:grid-cols-2 gap-6">
          <div>
            <h2 className="font-semibold text-lg">Ansprechpartner</h2>
            <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm items-start">
              {firma.contact_name && (
                <>
                  <div className="text-slate-500">Name</div>
                  <div className="text-slate-900 font-medium">
                    {firma.contact_name}
                  </div>
                </>
              )}
              {firma.contact_position && (
                <>
                  <div className="text-slate-500">Position</div>
                  <div className="text-slate-900">{firma.contact_position}</div>
                </>
              )}
              <div className="text-slate-500">E-Mail</div>
              <div className="text-slate-900">
                <a
                  href={`mailto:${firma.contact_email}`}
                  className="text-teal-700 hover:underline"
                >
                  {firma.contact_email}
                </a>
              </div>
              {firma.contact_phone && (
                <>
                  <div className="text-slate-500">Telefon</div>
                  <div className="text-slate-900">{firma.contact_phone}</div>
                </>
              )}
            </div>
            <a href={mailtoHref} className="btn-primary mt-6 inline-flex">
              Kontakt per E-Mail aufnehmen
            </a>
          </div>

          {hasAddress && (
            <div>
              <h2 className="font-semibold text-lg">Anschrift</h2>
              <address className="not-italic mt-3 text-sm text-slate-900 space-y-1">
                {firma.street && <div>{firma.street}</div>}
                {addressLine && <div>{addressLine}</div>}
                {firma.country && (
                  <div className="text-slate-600">{firma.country}</div>
                )}
              </address>
            </div>
          )}
        </div>
      </div>

      {firma.knowhows.length > 0 && (
        <Section title="Kunststoff Know-how">
          <div className="flex flex-wrap gap-2">
            {firma.knowhows.map((k) => (
              <span
                key={k.id}
                className="inline-flex items-center gap-2 rounded-full bg-teal-50 text-teal-800 border border-teal-100 px-3 py-1 text-sm"
                title={`Score: ${Math.min(k.score, 4)}`}
              >
                <span>{k.name}</span>
                <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full bg-teal-600 text-white text-[10px] font-semibold">
                  {Math.min(k.score, 4)}
                </span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {firma.technologies.length > 0 && (
        <Section title="Technologien">
          <ul className="space-y-3">
            {firma.technologies.map((t) => (
              <li
                key={t.id}
                className="rounded-md border border-line bg-white p-4"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="font-semibold">{t.name}</span>
                  {t.trl !== null && <TrlBadge trl={t.trl} />}
                </div>
                {t.notes && (
                  <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">
                    {t.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {firma.demos.length > 0 && (
        <Section title="Demonstrationsanlagen">
          <ul className="space-y-3">
            {firma.demos.map((d) => (
              <li
                key={d.id}
                className="rounded-md border border-line bg-white p-4"
              >
                <div className="font-semibold">{d.title}</div>
                {d.description && (
                  <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">
                    {d.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {firma.offers_services && firma.services.length > 0 && (
        <Section title="Dienstleistungen">
          <ul className="space-y-3">
            {firma.services.map((s) => (
              <li
                key={s.id}
                className="rounded-md border border-line bg-white p-4"
              >
                <div className="font-semibold">{s.title}</div>
                {s.description && (
                  <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">
                    {s.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {SHOW_MACHINES && firma.machines.length > 0 && (
        <Section title="Maschinen">
          <div className="flex flex-wrap gap-2">
            {firma.machines.map((m) => (
              <span
                key={m.id}
                className="badge bg-slate-100 text-slate-700 border border-slate-200"
              >
                {m.name}
              </span>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-6">
      <h2 className="font-semibold text-lg mb-4">{title}</h2>
      {children}
    </section>
  );
}
