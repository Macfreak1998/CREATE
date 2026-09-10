import AdminNav from "./AdminNav.js";
import IndustryGroupManager from "./components/IndustryGroupManager.js";
import IndustryManager from "./components/IndustryManager.js";

export default function AdminBranchen() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-semibold mb-6">Admin</h1>
      <AdminNav />
      <div className="space-y-6">
        <IndustryGroupManager />
        <IndustryManager />
      </div>
    </div>
  );
}
