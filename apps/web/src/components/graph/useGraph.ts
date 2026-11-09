import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { GraphEdgeKind, GraphFindResult, GraphScope } from "@b2b/shared";
import { api } from "../../lib/api.js";
import { isGraphSceneLayout } from "./layoutMode.js";
import { computeLayout, scopeSignature, type LayoutResult } from "./layout.js";

export const scopeQueryKey = (path: string) => ["graph", "scope", path] as const;

function scopeUrl(path: string): string {
  return path
    ? `/api/graph/scope?path=${encodeURIComponent(path)}`
    : "/api/graph/scope";
}

export function useGraphScope(path: string) {
  return useQuery<GraphScope>({
    queryKey: scopeQueryKey(path),
    queryFn: () => api.get<GraphScope>(scopeUrl(path)),
  });
}

/**
 * Laedt die Kinder einer Ebene vor, sobald der Zeiger darueber steht. Der
 * Uebergang beim Klick dauert rund 320 ms; in der Zeit ist die naechste Ebene
 * dann meist schon da.
 */
export function usePrefetchScope() {
  const qc = useQueryClient();
  return (path: string) =>
    qc.prefetchQuery({
      queryKey: scopeQueryKey(path),
      queryFn: () => api.get<GraphScope>(scopeUrl(path)),
      staleTime: 60_000,
    });
}

export function useGraphEdgeKinds() {
  return useQuery<GraphEdgeKind[]>({
    queryKey: ["graph", "edge-kinds"],
    queryFn: () => api.get<GraphEdgeKind[]>("/api/graph/edge-kinds"),
    staleTime: 5 * 60_000,
  });
}

export function useGraphSearch(term: string) {
  return useQuery<GraphFindResult[]>({
    queryKey: ["graph", "find", term],
    queryFn: () =>
      api.get<GraphFindResult[]>(`/api/graph/find?q=${encodeURIComponent(term)}`),
    enabled: term.trim().length >= 2,
  });
}

/**
 * Layout einer Ebene. Der Query-Cache haelt das Ergebnis pro Scope-Signatur,
 * damit dieselbe Ebene beim Zurueckspringen nicht neu berechnet wird.
 */
export function useScopeLayout(scope: GraphScope | undefined) {
  return useQuery<LayoutResult>({
    queryKey: ["graph", "layout", scope ? scopeSignature(scope) : ""],
    queryFn: () => computeLayout(scope as GraphScope),
    enabled: Boolean(scope && isGraphSceneLayout(scope.layout)),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
