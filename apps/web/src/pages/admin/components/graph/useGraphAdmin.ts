import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  GraphCompanyNode,
  GraphCompanyOption,
  GraphEdge,
  GraphEdgeKind,
  GraphEdgeKindInput,
  GraphLayer,
  GraphLayout,
  GraphScope,
  GraphSeedIndustriesResult,
} from "@b2b/shared";
import { api, ApiError } from "../../../../lib/api.js";

export const graphScopeKey = (parentId: string | null) =>
  ["admin", "graph", "scope", parentId] as const;

export const graphEdgeKindsKey = ["admin", "graph", "edge-kinds"] as const;

export interface LayerImpact {
  layers: number;
  companies: number;
  edges: number;
}

function scopePath(parentId: string | null): string {
  return parentId
    ? `/api/admin/graph/scope?parent_id=${encodeURIComponent(parentId)}`
    : "/api/admin/graph/scope";
}

export function useGraphScope(parentId: string | null) {
  return useQuery<GraphScope>({
    queryKey: graphScopeKey(parentId),
    queryFn: () => api.get<GraphScope>(scopePath(parentId)),
  });
}

export function useGraphEdgeKinds() {
  return useQuery<GraphEdgeKind[]>({
    queryKey: graphEdgeKindsKey,
    queryFn: () => api.get<GraphEdgeKind[]>("/api/admin/graph/edge-kinds"),
  });
}

export function useCompanyOptions(parentId: string | null, search: string) {
  return useQuery<GraphCompanyOption[]>({
    queryKey: ["admin", "graph", "companies", parentId, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (parentId) params.set("parent_id", parentId);
      const suffix = params.toString();
      return api.get<GraphCompanyOption[]>(
        `/api/admin/graph/companies${suffix ? `?${suffix}` : ""}`
      );
    },
  });
}

export function loadLayerImpact(layerId: string): Promise<LayerImpact> {
  return api.get<LayerImpact>(`/api/admin/graph/layers/${layerId}/impact`);
}

export interface GraphMutationOptions {
  onError: (message: string) => void;
}

/**
 * Buendelt alle schreibenden Operationen des Graph-Editors. Drag & Drop und die
 * Buttons der drei Listen nutzen dieselben Mutationen, damit es keine zweite
 * Schreiblogik gibt.
 */
export function useGraphMutations({ onError }: GraphMutationOptions) {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "graph"] });
    // Oeffentliche Ansicht teilt die Daten, aber nicht die Query-Keys.
    qc.invalidateQueries({ queryKey: ["graph"] });
  };

  const handleError = (err: unknown) => {
    onError(err instanceof ApiError ? err.message : "Unbekannter Fehler.");
  };

  const mutationDefaults = {
    onSuccess: invalidate,
    onError: handleError,
  };

  const seedIndustries = useMutation({
    mutationFn: (input: { parentId: string | null; industryGroupId: number }) =>
      api.post<GraphSeedIndustriesResult>("/api/admin/graph/seed-industries", {
        parent_id: input.parentId,
        industry_group_id: input.industryGroupId,
      }),
    ...mutationDefaults,
  });

  const createLayer = useMutation({
    mutationFn: (input: {
      parent_id: string | null;
      name: string;
      description: string | null;
      color: string | null;
      layout: GraphLayout;
      radial_industry_group_id: number | null;
    }) => api.post<GraphLayer>("/api/admin/graph/layers", input),
    ...mutationDefaults,
  });

  const updateLayer = useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      name: string;
      description: string | null;
      color: string | null;
      layout: GraphLayout;
      radial_industry_group_id: number | null;
    }) => api.patch<GraphLayer>(`/api/admin/graph/layers/${id}`, input),
    ...mutationDefaults,
  });

  const updateRootLayout = useMutation({
    mutationFn: (input: {
      layout: GraphLayout;
      radial_industry_group_id?: number | null;
    }) =>
      api.patch<{ layout: GraphLayout }>("/api/admin/graph/root-layout", input),
    ...mutationDefaults,
  });

  const addCompany = useMutation({
    mutationFn: (input: { parent_id: string | null; company_id: string }) =>
      api.post<GraphCompanyNode>("/api/admin/graph/nodes", input),
    ...mutationDefaults,
  });

  const moveNode = useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) =>
      api.post<{ ok: true }>(`/api/admin/graph/nodes/${id}/move`, {
        parent_id: parentId,
      }),
    ...mutationDefaults,
  });

  const reorderNodes = useMutation({
    mutationFn: (nodeIds: string[]) =>
      api.post<{ ok: true }>("/api/admin/graph/nodes/reorder", {
        node_ids: nodeIds,
      }),
    ...mutationDefaults,
  });

  const deleteNode = useMutation({
    mutationFn: (id: string) =>
      api.delete<{ ok: true }>(`/api/admin/graph/nodes/${id}`),
    ...mutationDefaults,
  });

  const createEdge = useMutation({
    mutationFn: (input: {
      source_id: string;
      target_id: string;
      edge_kind_id: number;
      label: string | null;
    }) => api.post<GraphEdge>("/api/admin/graph/edges", input),
    ...mutationDefaults,
  });

  const updateEdge = useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      edge_kind_id: number;
      label: string | null;
    }) => api.patch<GraphEdge>(`/api/admin/graph/edges/${id}`, input),
    ...mutationDefaults,
  });

  const deleteEdge = useMutation({
    mutationFn: (id: string) =>
      api.delete<{ ok: true }>(`/api/admin/graph/edges/${id}`),
    ...mutationDefaults,
  });

  const createEdgeKind = useMutation({
    mutationFn: (input: GraphEdgeKindInput) =>
      api.post<GraphEdgeKind>("/api/admin/graph/edge-kinds", input),
    ...mutationDefaults,
  });

  const updateEdgeKind = useMutation({
    mutationFn: ({ id, ...input }: GraphEdgeKindInput & { id: number }) =>
      api.patch<GraphEdgeKind>(`/api/admin/graph/edge-kinds/${id}`, input),
    ...mutationDefaults,
  });

  const setAnonymous = useMutation({
    mutationFn: ({
      companyId,
      anonymous,
    }: {
      companyId: string;
      anonymous: boolean;
    }) =>
      api.patch<{ anonymous: boolean }>(
        `/api/admin/companies/${companyId}/anonymous`,
        { anonymous }
      ),
    onMutate: async ({ companyId, anonymous }) => {
      await qc.cancelQueries({ queryKey: ["admin", "graph", "scope"] });
      qc.setQueriesData<GraphScope>(
        { queryKey: ["admin", "graph", "scope"] },
        (current) => {
          if (!current) return current;
          return {
            ...current,
            companies: current.companies.map((company) =>
              company.company_id === companyId
                ? { ...company, anonymous }
                : company
            ),
          };
        }
      );
    },
    ...mutationDefaults,
    onError: (err) => {
      qc.invalidateQueries({ queryKey: ["admin", "graph", "scope"] });
      handleError(err);
    },
  });

  const deleteEdgeKind = useMutation({
    mutationFn: (id: number) =>
      api.delete<{ ok: true }>(`/api/admin/graph/edge-kinds/${id}`),
    ...mutationDefaults,
  });

  return {
    seedIndustries,
    createLayer,
    updateLayer,
    updateRootLayout,
    addCompany,
    moveNode,
    reorderNodes,
    deleteNode,
    createEdge,
    updateEdge,
    deleteEdge,
    setAnonymous,
    createEdgeKind,
    updateEdgeKind,
    deleteEdgeKind,
  };
}

export type GraphMutations = ReturnType<typeof useGraphMutations>;
