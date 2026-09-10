import { ReactNode } from "react";

// Sticky-Footer mit Save-Button. Bleibt am unteren Rand sichtbar, sobald die
// Seite nach unten gescrollt wird. Erscheint nur bei ungespeicherten
// Aenderungen, damit der Rest der Seite ungestoert bleibt.
export default function SaveBar({
  visible,
  saving,
  saveLabel = "Speichern",
  savingLabel = "Speichern ...",
  message,
  children,
  variant = "warning",
}: {
  visible: boolean;
  saving?: boolean;
  saveLabel?: string;
  savingLabel?: string;
  message?: string;
  children?: ReactNode;
  variant?: "warning" | "info";
}) {
  if (!visible) return null;
  const bg =
    variant === "info"
      ? "bg-white/95 border-line"
      : "bg-amber-50/95 border-amber-200";
  return (
    <div
      className={[
        "sticky bottom-0 z-30 -mx-4 px-4 py-3 backdrop-blur border-t",
        bg,
        "flex flex-wrap items-center justify-between gap-3",
      ].join(" ")}
    >
      <div className="text-sm text-amber-800">
        {message ?? "Sie haben ungespeicherte Aenderungen."}
      </div>
      <div className="flex items-center gap-2">
        {children}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? savingLabel : saveLabel}
        </button>
      </div>
    </div>
  );
}
