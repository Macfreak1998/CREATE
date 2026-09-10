import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { GraphEdge, GraphLayer } from "@b2b/shared";
import AdminNav from "./AdminNav.js";
import { parseDropInto } from "./components/graph/DragDrop.js";
import ScopeBreadcrumb from "./components/graph/ScopeBreadcrumb.js";
import LayerList from "./components/graph/LayerList.js";
import CompanyList from "./components/graph/CompanyList.js";
import EdgeList from "./components/graph/EdgeList.js";
import EdgeDialog, {
  type EdgeFormValues,
  type ScopeNodeOption,
} from "./components/graph/EdgeDialog.js";
import EdgeKindManager from "./components/graph/EdgeKindManager.js";
import LayerDialog, {
  type LayerFormValues,
} from "./components/graph/LayerDialog.js";
import {
  loadLayerImpact,
  useGraphEdgeKinds,
  useGraphMutations,
  useGraphScope,
} from "./components/graph/useGraphAdmin.js";

type LayerDialogState = { open: false } | { open: true; layer: GraphLayer | null };
type EdgeDialogState = { open: false } | { open: true; edge: GraphEdge | null };

export default function AdminGraph() {
  const [searchParams, setSearchParams] = useSearchParams();
  const parentId = searchParams.get("ebene");

  const [error, setError] = useState<string | null>(null);
  const [layerDialog, setLayerDialog] = useState<LayerDialogState>({ open: false });
  const [edgeDialog, setEdgeDialog] = useState<EdgeDialogState>({ open: false });
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const scope = useGraphScope(parentId);
  const edgeKinds = useGraphEdgeKinds();
  const mutations = useGraphMutations({ onError: setError });

  const openLayer = (layerId: string | null) => {
    setError(null);
    if (layerId) {
      setSearchParams({ ebene: layerId });
    } else {
      setSearchParams({});
    }
  };

  const layers = scope.data?.layers ?? [];
  const companies = scope.data?.companies ?? [];

  // Beide Listen teilen sich den sort_order-Raum ihrer Elternebene. Beim
  // Umsortieren wird deshalb immer die komplette Reihenfolge des Scopes
  // gesendet, nicht nur die der bewegten Liste.
  const orderedNodeIds = useMemo(
    () => [...layers.map((l) => l.id), ...companies.map((c) => c.id)],
    [layers, companies]
  );

  const scopeNodes: ScopeNodeOption[] = useMemo(
    () => [
      ...layers.map((layer) => ({
        id: layer.id,
        label: layer.name,
        kind: "layer" as const,
      })),
      ...companies.map((node) => ({
        id: node.id,
        label: node.company_name,
        kind: "company" as const,
      })),
    ],
    [layers, companies]
  );

  const moveWithin = (
    ids: string[],
    nodeId: string,
    direction: -1 | 1
  ): string[] | null => {
    const index = ids.indexOf(nodeId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return null;
    const next = [...ids];
    [next[index], next[target]] = [next[target]!, next[index]!];
    return next;
  };

  const reorderLayers = (layerId: string, direction: -1 | 1) => {
    const reordered = moveWithin(
      layers.map((l) => l.id),
      layerId,
      direction
    );
    if (!reordered) return;
    mutations.reorderNodes.mutate([...reordered, ...companies.map((c) => c.id)]);
  };

  const reorderCompanies = (nodeId: string, direction: -1 | 1) => {
    const reordered = moveWithin(
      companies.map((c) => c.id),
      nodeId,
      direction
    );
    if (!reordered) return;
    mutations.reorderNodes.mutate([...layers.map((l) => l.id), ...reordered]);
  };

  // Ein Klick auf den Anfasser darf nicht sofort als Drag gelten, sonst
  // reagieren die Buttons in derselben Zeile nicht mehr zuverlaessig.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const nodeLabel = (nodeId: string) =>
    scopeNodes.find((node) => node.id === nodeId)?.label ?? "";

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const nodeId = String(active.id);
    const overId = String(over.id);
    if (nodeId === overId) return;

    // Fall 1: Ablage auf einer Ebenen- oder Breadcrumb-Zone verschiebt den
    // Knoten dorthin.
    const targetLayerId = parseDropInto(overId);
    if (targetLayerId !== undefined) {
      if (targetLayerId === nodeId || targetLayerId === parentId) return;
      setError(null);
      mutations.moveNode.mutate({ id: nodeId, parentId: targetLayerId });
      return;
    }

    // Fall 2: Ablage auf einer Zeile derselben Liste sortiert um.
    const layerIds = layers.map((layer) => layer.id);
    const companyIds = companies.map((node) => node.id);
    const list = layerIds.includes(nodeId) ? layerIds : companyIds;
    if (!list.includes(overId)) return;

    const from = list.indexOf(nodeId);
    const to = list.indexOf(overId);
    const reordered = [...list];
    reordered.splice(to, 0, reordered.splice(from, 1)[0]!);

    setError(null);
    mutations.reorderNodes.mutate(
      list === layerIds ? [...reordered, ...companyIds] : [...layerIds, ...reordered]
    );
  };

  const submitLayer = (values: LayerFormValues) => {
    if (!layerDialog.open) return;
    const existing = layerDialog.layer;
    setError(null);
    if (existing) {
      mutations.updateLayer.mutate(
        { id: existing.id, ...values },
        { onSuccess: () => setLayerDialog({ open: false }) }
      );
    } else {
      mutations.createLayer.mutate(
        { parent_id: parentId, ...values },
        { onSuccess: () => setLayerDialog({ open: false }) }
      );
    }
  };

  const submitEdge = (values: EdgeFormValues) => {
    if (!edgeDialog.open) return;
    setError(null);
    const existing = edgeDialog.edge;
    if (existing) {
      mutations.updateEdge.mutate(
        {
          id: existing.id,
          edge_kind_id: values.edge_kind_id,
          label: values.label,
        },
        { onSuccess: () => setEdgeDialog({ open: false }) }
      );
    } else {
      mutations.createEdge.mutate(values, {
        onSuccess: () => setEdgeDialog({ open: false }),
      });
    }
  };

  const deleteLayer = async (layer: GraphLayer) => {
    setError(null);
    const impact = await loadLayerImpact(layer.id).catch(() => null);
    const details = impact
      ? `\n\nDabei werden ${impact.layers} Unterebene(n), ${impact.companies} Firmenzuordnung(en) und ${impact.edges} Verbindung(en) mit gelöscht.`
      : "";
    if (confirm(`Ebene "${layer.name}" wirklich löschen?${details}`)) {
      mutations.deleteNode.mutate(layer.id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-semibold mb-6">Admin</h1>
      <AdminNav />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDragId(null)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ScopeBreadcrumb
            breadcrumb={scope.data?.breadcrumb ?? []}
            activeDragId={activeDragId}
            onOpen={openLayer}
          />
          {scope.data?.layer && (
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() =>
                setLayerDialog({ open: true, layer: scope.data?.layer ?? null })
              }
            >
              Diese Ebene bearbeiten
            </button>
          )}
        </div>

        {scope.data?.layer?.description && (
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            {scope.data.layer.description}
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {scope.isError && (
          <p className="mt-4 text-sm text-red-600">
            Die Ebene konnte nicht geladen werden.
          </p>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <LayerList
            layers={layers}
            activeDragId={activeDragId}
            onOpen={openLayer}
            onCreate={() => setLayerDialog({ open: true, layer: null })}
            onEdit={(layer) => setLayerDialog({ open: true, layer })}
            onDelete={deleteLayer}
            onMove={reorderLayers}
          />

          <CompanyList
            parentId={parentId}
            companies={companies}
            onAdd={(companyId) => {
              setError(null);
              mutations.addCompany.mutate({
                parent_id: parentId,
                company_id: companyId,
              });
            }}
            onRemove={(node) => {
              if (confirm(`${node.company_name} aus dieser Ebene entfernen?`)) {
                mutations.deleteNode.mutate(node.id);
              }
            }}
            onMove={reorderCompanies}
          />

          <EdgeList
            edges={scope.data?.edges ?? []}
            outwardEdges={scope.data?.outward_edges ?? []}
            nodes={scopeNodes}
            onCreate={() => setEdgeDialog({ open: true, edge: null })}
            onEdit={(edge) => setEdgeDialog({ open: true, edge })}
            onDelete={(edge) => {
              if (confirm("Verbindung wirklich löschen?")) {
                mutations.deleteEdge.mutate(edge.id);
              }
            }}
          />
        </div>

        <DragOverlay>
          {activeDragId && (
            <div className="rounded-md border border-line bg-white px-3 py-2 text-sm shadow-card">
              {nodeLabel(activeDragId)}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <div className="mt-4">
        <EdgeKindManager
          edgeKinds={edgeKinds.data ?? []}
          mutations={mutations}
        />
      </div>

      {orderedNodeIds.length === 0 && !scope.isLoading && (
        <p className="mt-6 text-sm text-slate-500">
          Diese Ebene ist leer. Lege eine Unterebene an oder nimm eine Firma auf.
        </p>
      )}

      {layerDialog.open && (
        <LayerDialog
          layer={layerDialog.layer}
          onSubmit={submitLayer}
          onClose={() => setLayerDialog({ open: false })}
        />
      )}

      {edgeDialog.open && (
        <EdgeDialog
          nodes={scopeNodes}
          edgeKinds={edgeKinds.data ?? []}
          edge={edgeDialog.edge}
          onSubmit={submitEdge}
          onClose={() => setEdgeDialog({ open: false })}
        />
      )}
    </div>
  );
}
