import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.js";
import UnsavedChangesProvider from "./components/UnsavedChangesProvider.js";
import RequireAuth from "./components/RequireAuth.js";
import Home from "./pages/Home.js";
import Suche from "./pages/Suche.js";
import Firma from "./pages/Firma.js";
import Login from "./pages/Login.js";
import Registrieren from "./pages/Registrieren.js";
import Profil from "./pages/Profil.js";
import PasswortVergessen from "./pages/PasswortVergessen.js";
import PasswortZuruecksetzen from "./pages/PasswortZuruecksetzen.js";
import AdminDashboard from "./pages/admin/Dashboard.js";
import AdminFirmen from "./pages/admin/Firmen.js";
import AdminFirmaNeu from "./pages/admin/FirmaNeu.js";
import AdminFirmaEdit from "./pages/admin/FirmaEdit.js";
import AdminTechnologien from "./pages/admin/Technologien.js";
import AdminBranchen from "./pages/admin/Branchen.js";
import AdminUnternehmensgroessen from "./pages/admin/Unternehmensgroessen.js";
import AdminKnowHow from "./pages/admin/KnowHow.js";
import AdminGraph from "./pages/admin/Graph.js";
import AdminReporting from "./pages/admin/Reporting.js";
import AdminEinstellungen from "./pages/admin/Einstellungen.js";
import AdminHilfetexte from "./pages/admin/Hilfetexte.js";
import AdminMailTemplates from "./pages/admin/MailTemplates.js";
import AdminFeedback from "./pages/admin/Feedback.js";
import AdminTechVorschlaege from "./pages/admin/TechVorschlaege.js";
import AdminTracker from "./pages/admin/Tracker.js";
import Feedback from "./pages/Feedback.js";

// Der Graph bringt React Flow und elkjs mit, zusammen rund ein Megabyte. Beides
// wird erst geladen, wenn jemand die Netzwerkansicht tatsaechlich oeffnet.
const Netzwerk = lazy(() => import("./pages/Netzwerk.js"));

export default function App() {
  return (
    <UnsavedChangesProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="/suche" element={<Suche />} />
          <Route
            path="/netzwerk/*"
            element={
              <Suspense fallback={<PageLoading />}>
                <Netzwerk />
              </Suspense>
            }
          />
          <Route path="/firma/:slug" element={<Firma />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registrieren" element={<Registrieren />} />
          <Route path="/passwort-vergessen" element={<PasswortVergessen />} />
          <Route
            path="/passwort-zuruecksetzen"
            element={<PasswortZuruecksetzen />}
          />
          <Route path="/feedback" element={<Feedback />} />
          <Route element={<RequireAuth />}>
            <Route path="/profil" element={<Profil />} />
          </Route>
          <Route element={<RequireAuth role="admin" />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/firmen" element={<AdminFirmen />} />
            <Route path="/admin/firmen/neu" element={<AdminFirmaNeu />} />
            <Route path="/admin/firmen/:id" element={<AdminFirmaEdit />} />
            <Route path="/admin/technologien" element={<AdminTechnologien />} />
            <Route path="/admin/branchen" element={<AdminBranchen />} />
            <Route
              path="/admin/unternehmensgroessen"
              element={<AdminUnternehmensgroessen />}
            />
            <Route path="/admin/knowhow" element={<AdminKnowHow />} />
            <Route
              path="/admin/tech-vorschlaege"
              element={<AdminTechVorschlaege />}
            />
            <Route path="/admin/hilfetexte" element={<AdminHilfetexte />} />
            <Route
              path="/admin/mail-templates"
              element={<AdminMailTemplates />}
            />
            <Route path="/admin/graph" element={<AdminGraph />} />
            <Route path="/admin/reporting" element={<AdminReporting />} />
            <Route path="/admin/tracker" element={<AdminTracker />} />
            <Route path="/admin/feedback" element={<AdminFeedback />} />
            <Route
              path="/admin/einstellungen"
              element={<AdminEinstellungen />}
            />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </UnsavedChangesProvider>
  );
}

function PageLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-24 text-center text-slate-500">
      Wird geladen …
    </div>
  );
}

function NotFound() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold">Seite nicht gefunden</h1>
      <p className="mt-2 text-slate-600">
        Die aufgerufene Seite existiert nicht.
      </p>
    </div>
  );
}
