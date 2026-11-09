import { useCallback, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ReactFlowProvider } from "@xyflow/react";
import type { GraphCompanyNode, GraphLayer } from "@b2b/shared";
import GraphScene from "../components/graph/GraphScene.js";
import GraphSearch from "../components/graph/GraphSearch.js";
import EdgeLegend from "../components/graph/EdgeLegend.js";
import OutwardEdgeChips from "../components/graph/OutwardEdgeChips.js";
import CirclePackView from "../components/graph/CirclePackView.js";
import RadialRingView from "../components/graph/RadialRingView.js";
import {
  useGraphEdgeKinds,
  useGraphScope,
  usePrefetchScope,
  useScopeLayout,
} from "../components/graph/useGraph.js";
import { SHOW_NETWORK_GRAPH } from "../config/features.js";

const BASE_PATH = "/netzwerk";

function scopePathFromLocation(pathname: string): string {
  const rest = pathname.slice(BASE_PATH.length);
  return rest.replace(/^\/+|\/+$/g, "");
}

export default function Netzwerk() {
  const location = useLocation();
  const navigate = useNavigate();
  const scopePath = scopePathFromLocation(location.pathname);

  const scope = useGraphScope(scopePath);
  const edgeKinds = useGraphEdgeKinds();
  const layout = useScopeLayout(scope.data);
  const prefetchScope = usePrefetchScope();

  const openPath = useCallback(
    (path: string) => navigate(path ? `${BASE_PATH}/${path}` : BASE_PATH),
    [navigate]
  );

  // Eine Ebene hoch: das letzte Segment des Pfades faellt weg.
  const goUp = useCallback(() => {
    if (!scopePath) return;
    openPath(scopePath.split("/").slice(0, -1).join("/"));
  }, [openPath, scopePath]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") goUp();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goUp]);

  const childPath = useCallback(
    (layer: GraphLayer) =>
      scopePath ? `${scopePath}/${layer.slug}` : layer.slug,
    [scopePath]
  );

  const openLayer = useCallback(
    (layer: GraphLayer) => openPath(childPath(layer)),
    [childPath, openPath]
  );

  // Firmenprofile oeffnen in einem neuen Tab, damit die aktuelle Position im
  // Graphen erhalten bleibt und nicht neu herangezoomt werden muss.
  const openCompany = useCallback((company: GraphCompanyNode) => {
    if (company.anonymous || !company.company_slug) return;
    window.open(`/firma/${company.company_slug}`, "_blank", "noopener,noreferrer");
  }, []);

  if (!SHOW_NETWORK_GRAPH) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-3xl font-semibold">Netzwerkgraph</h1>
        <p className="mt-2 text-slate-600">
          Die Netzwerkansicht wird gerade aufgebaut und ist bald verfügbar.
        </p>
      </div>
    );
  }

  const breadcrumb = scope.data?.breadcrumb ?? [];
  const notFound = scope.isError;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Netzwerk</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            {scope.data?.layout === "pack"
              ? "Jede Branche ist ein Kreis, Firmen sitzen darin. Ein Klick hebt alle Stellen derselben Firma hervor."
              : scope.data?.layout === "radial"
                ? "Jede Firma steht einmal auf dem Ring. Ein Segment filtert auf diese Stufe."
                : "Klicken Sie auf eine Ebene, um hineinzuzoomen. Mit Escape oder über den Pfad geht es zurück."}
          </p>
        </div>
        <GraphSearch onSelect={(result) => openPath(result.parent_path)} />
      </div>

      <nav
        aria-label="Ebenenpfad"
        className="mt-4 flex flex-wrap items-center gap-1 text-sm text-slate-600"
      >
        <button
          type="button"
          className="rounded px-2 py-1 font-medium hover:bg-slate-100"
          onClick={() => openPath("")}
        >
          Netzwerk
        </button>
        {breadcrumb.map((item, index) => (
          <span key={item.id} className="flex items-center gap-1">
            <span aria-hidden="true" className="text-slate-400">
              /
            </span>
            <button
              type="button"
              className={[
                "rounded px-2 py-1 hover:bg-slate-100",
                index === breadcrumb.length - 1 ? "font-semibold text-ink" : "",
              ].join(" ")}
              aria-current={index === breadcrumb.length - 1 ? "page" : undefined}
              onClick={() => openPath(item.path)}
            >
              {item.name}
            </button>
          </span>
        ))}
      </nav>

      {scope.data?.layer?.description && (
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          {scope.data.layer.description}
        </p>
      )}

      {notFound ? (
        <div className="mt-6 card p-8 text-center">
          <p className="text-slate-600">Diese Ebene gibt es nicht.</p>
          <Link to={BASE_PATH} className="btn-secondary mt-4 inline-flex">
            Zur Übersicht
          </Link>
        </div>
      ) : (
        <div className="relative mt-4 h-[70vh] overflow-hidden rounded-lg border border-line bg-white">
          {scope.data?.layout === "pack" ? (
            <CirclePackView tree={scope.data.tree ?? []} />
          ) : scope.data?.layout === "radial" ? (
            <RadialRingView
              tree={scope.data.tree ?? []}
              group={scope.data.radial_industry_group}
              industries={scope.data.radial_industries}
            />
          ) : (
            <ReactFlowProvider>
              <GraphScene
                scopePath={scopePath}
                nodes={layout.data?.nodes ?? []}
                edges={layout.data?.edges ?? []}
                isLoading={scope.isLoading || layout.isLoading}
                onOpenLayer={openLayer}
                onPrefetchLayer={(layer) => void prefetchScope(childPath(layer))}
                onOpenCompany={openCompany}
              />
            </ReactFlowProvider>
          )}
          {scope.data?.layout === "graph" && (
            <OutwardEdgeChips edges={scope.data.outward_edges} />
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {scope.data?.layout === "graph" && (
          <EdgeLegend edgeKinds={edgeKinds.data ?? []} />
        )}
        {scopePath && (
          <button type="button" className="btn-secondary ml-auto text-xs" onClick={goUp}>
            Eine Ebene zurück
          </button>
        )}
      </div>
    </div>
  );
}
