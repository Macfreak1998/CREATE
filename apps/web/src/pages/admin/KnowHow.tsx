import AdminNav from "./AdminNav.js";
import TaxonomyManager from "./components/TaxonomyManager.js";

export default function AdminKnowHow() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-semibold mb-6">Admin</h1>
      <AdminNav />
      <TaxonomyManager title="Know-how" kind="knowhows" />
    </div>
  );
}
