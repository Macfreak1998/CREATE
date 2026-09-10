import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import type { FeedbackInput } from "@b2b/shared";
import { api, ApiError } from "../lib/api.js";

const STORAGE_KEY_UNTIL = "create-feedback-prompt-until";
const STORAGE_KEY_PAGEVIEWS = "create-feedback-prompt-pageviews";
const AUTO_SHOW_PAGEVIEWS = 3;
const AUTO_SHOW_AFTER_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function readUntil(): number {
  try {
    return Number(localStorage.getItem(STORAGE_KEY_UNTIL) ?? "0") || 0;
  } catch {
    return 0;
  }
}

function writeUntil(value: number): void {
  try {
    localStorage.setItem(STORAGE_KEY_UNTIL, String(value));
  } catch {
    // Privatmodus: nicht persistieren.
  }
}

function readPageviews(): number {
  try {
    return Number(sessionStorage.getItem(STORAGE_KEY_PAGEVIEWS) ?? "0") || 0;
  } catch {
    return 0;
  }
}

function writePageviews(value: number): void {
  try {
    sessionStorage.setItem(STORAGE_KEY_PAGEVIEWS, String(value));
  } catch {
    // ignore
  }
}

export default function FeedbackPrompt() {
  const location = useLocation();
  const onAdminRoute = location.pathname.startsWith("/admin");
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: FeedbackInput) =>
      api.post<{ ok: true }>("/api/feedback", input),
    onSuccess: () => {
      setSubmitted(true);
      writeUntil(Date.now() + 365 * DAY_MS);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Senden fehlgeschlagen.");
    },
  });

  // Pageview-Counter pro Session.
  useEffect(() => {
    if (onAdminRoute) return;
    writePageviews(readPageviews() + 1);
  }, [location.pathname, onAdminRoute]);

  // Auto-Trigger: nach N Pageviews oder T ms aktiver Verweildauer.
  useEffect(() => {
    if (onAdminRoute) return;
    if (open || submitted) return;
    if (Date.now() < readUntil()) return;

    if (readPageviews() >= AUTO_SHOW_PAGEVIEWS) {
      const t = window.setTimeout(() => setOpen(true), 1000);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      if (Date.now() >= readUntil()) setOpen(true);
    }, AUTO_SHOW_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [onAdminRoute, open, submitted, location.pathname]);

  if (onAdminRoute) return null;

  const close = () => {
    setOpen(false);
    setError(null);
  };

  const remindLater = () => {
    writeUntil(Date.now() + 14 * DAY_MS);
    close();
  };

  const dismissForever = () => {
    writeUntil(Date.now() + 365 * 10 * DAY_MS);
    close();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (message.trim().length < 10) {
      setError("Bitte gib eine Nachricht mit mindestens 10 Zeichen ein.");
      return;
    }
    mutation.mutate({ email, message: message.trim(), website });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setSubmitted(false);
          setError(null);
        }}
        className="fixed bottom-5 right-5 z-40 btn-accent shadow-lg px-4 py-3 rounded-full"
        aria-label="Feedback geben"
      >
        Feedback geben
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-prompt-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={remindLater}
        >
          <div
            className="card max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 id="feedback-prompt-title" className="text-xl font-semibold">
                {submitted ? "Vielen Dank!" : "Wie gefällt Ihnen CREATE?"}
              </h2>
              <button
                type="button"
                onClick={dismissForever}
                className="text-slate-500 hover:text-slate-900"
                aria-label="Nicht mehr fragen"
                title="Nicht mehr fragen"
              >
                X
              </button>
            </div>

            {submitted ? (
              <div className="text-sm text-emerald-700 space-y-3">
                <p>Wir haben Ihr Feedback erhalten.</p>
                <button type="button" onClick={close} className="btn-primary">
                  Weiter
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-3">
                <p className="text-sm text-slate-600">
                  Wir freuen uns über Hinweise, Wünsche oder Bugs. Antwort
                  erfolgt bei Bedarf an die angegebene E-Mail-Adresse.
                </p>
                <div>
                  <label className="label" htmlFor="fp-email">
                    E-Mail-Adresse
                  </label>
                  <input
                    id="fp-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    maxLength={200}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="fp-message">
                    Nachricht
                  </label>
                  <textarea
                    id="fp-message"
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="input min-h-[120px]"
                    rows={5}
                    maxLength={5000}
                  />
                </div>
                <div aria-hidden="true" className="hidden">
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex flex-wrap justify-between gap-2 pt-1">
                  <div className="flex gap-2 text-sm">
                    <button
                      type="button"
                      onClick={remindLater}
                      className="text-slate-600 hover:underline"
                    >
                      Später erinnern
                    </button>
                    <button
                      type="button"
                      onClick={dismissForever}
                      className="text-slate-500 hover:underline"
                    >
                      Nicht mehr fragen
                    </button>
                  </div>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={mutation.isPending}
                  >
                    {mutation.isPending ? "Wird gesendet ..." : "Feedback senden"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
