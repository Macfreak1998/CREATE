import { useState, type ReactNode } from "react";

// Umschliesst eine Ueberschrift und zeigt den hinterlegten Hilfetext beim
// Hovern ueber Titel oder Icon, beim Tastaturfokus sowie per Klick (Touch).
// Ohne Text wird nur der Titel gerendert.
export default function InfoHint({
  text,
  children,
}: {
  text?: string | null;
  children: ReactNode;
}) {
  const [pinned, setPinned] = useState(false);

  if (!text) return <>{children}</>;

  return (
    <span className="group relative inline-flex items-center gap-1.5">
      {children}
      <button
        type="button"
        aria-label={`Hinweis: ${text}`}
        aria-expanded={pinned}
        onClick={(e) => {
          // Verhindert, dass ein umgebendes <summary> mitreagiert.
          e.preventDefault();
          e.stopPropagation();
          setPinned((v) => !v);
        }}
        className="text-slate-400 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 rounded-full"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M12 11v5" />
          <path strokeLinecap="round" d="M12 8h.01" />
        </svg>
      </button>
      <span
        aria-hidden="true"
        className={[
          "pointer-events-none absolute left-0 top-full z-20 mt-1 w-72 max-w-[80vw]",
          "rounded-md border border-line bg-white p-3 text-xs font-normal normal-case",
          "tracking-normal text-slate-700 shadow-card transition-opacity",
          "group-hover:visible group-hover:opacity-100",
          "group-focus-within:visible group-focus-within:opacity-100",
          pinned ? "visible opacity-100" : "invisible opacity-0",
        ].join(" ")}
      >
        {text}
      </span>
    </span>
  );
}
