import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../lib/api.js";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const DWELL_FLUSH_MS = 15_000;

function parseCompanySlug(pathname: string): string | undefined {
  const match = pathname.match(/^\/firma\/([^/]+)\/?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function sendPageview(path: string): void {
  if (path.startsWith("/admin")) return;
  const company_slug = parseCompanySlug(path);
  void api
    .post<{ ok: true }>("/api/analytics/pageview", {
      path,
      ...(company_slug ? { company_slug } : {}),
    })
    .catch(() => {
      // Tracking darf die UX nicht stoeren.
    });
}

function sendDwell(seconds: number): void {
  if (seconds < 1) return;
  const capped = Math.min(Math.floor(seconds), 3600);
  const payload = JSON.stringify({ seconds: capped });
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(`${API_BASE}/api/analytics/dwell`, blob);
      return;
    }
  } catch {
    // Fallback unten.
  }
  void api
    .post<{ ok: true }>("/api/analytics/dwell", { seconds: capped })
    .catch(() => {
      // ignore
    });
}

/**
 * Erfasst Pageviews und sichtbare Verweildauer (ohne Admin-Routen).
 */
export default function AnalyticsTracker() {
  const location = useLocation();
  const visibleSince = useRef<number | null>(null);
  const accumulated = useRef(0);
  const lastPath = useRef<string | null>(null);

  const flushDwell = () => {
    if (visibleSince.current != null) {
      accumulated.current += (Date.now() - visibleSince.current) / 1000;
      visibleSince.current =
        document.visibilityState === "visible" ? Date.now() : null;
    }
    const seconds = accumulated.current;
    if (seconds < 1) return;
    accumulated.current = 0;
    sendDwell(seconds);
  };

  useEffect(() => {
    if (location.pathname.startsWith("/admin")) {
      flushDwell();
      lastPath.current = location.pathname;
      return;
    }
    if (lastPath.current !== location.pathname) {
      flushDwell();
      sendPageview(location.pathname + location.search);
      lastPath.current = location.pathname;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        visibleSince.current = Date.now();
      } else {
        flushDwell();
      }
    };
    const onPageHide = () => flushDwell();

    if (document.visibilityState === "visible") {
      visibleSince.current = Date.now();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    const interval = window.setInterval(() => flushDwell(), DWELL_FLUSH_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(interval);
      flushDwell();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
