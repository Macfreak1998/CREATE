import AdminNav from "./AdminNav.js";
import TaxonomyManager from "./components/TaxonomyManager.js";
import TechnologyGroupManager from "./components/TechnologyGroupManager.js";
import TechnologyManager from "./components/TechnologyManager.js";
import { SHOW_MACHINES } from "../../config/features.js";

export default function AdminTechnologien() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-semibold mb-6">Admin</h1>
      <AdminNav />
      <div className="space-y-6">
        <TechnologyGroupManager />
        <TechnologyManager />
        {SHOW_MACHINES && (
          <TaxonomyManager title="Maschinen" kind="machines" />
        )}
      </div>
    </div>
  );
}
