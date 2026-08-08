import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { trackPageview } from "@/lib/trackDownload";
import { tiktokPageView } from "@/lib/tiktok";
import Home from "./pages/Home";
import Privacy from "./pages/Privacy";
import Login from "./pages/Login";
import Register from "./pages/Register";
import LeaguePage from "./pages/LeaguePage";
import DownloadPage from "./pages/DownloadPage";
import CommunityLeaguePage from "./pages/CommunityLeaguePage";

// La dashboard admin è caricata solo quando serve: i visitatori del sito
// pubblico non devono scaricarne il codice.
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics"));

// Registra una visita interna ad ogni cambio pagina (SPA).
function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    // Non tracciare il traffico interno (pannello admin, login).
    if (/^\/(admin|login)/i.test(location.pathname)) return;
    trackPageview();
    // Il pixel e' gia' caricato da index.html: qui si emette solo il PageView,
    // una volta per rotta. Il pixel non viene mai reinizializzato.
    tiktokPageView();
  }, [location.pathname, location.search]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <RouteTracker />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/lega" element={<LeaguePage />} />
        <Route path="/super-league" element={<LeaguePage />} />
        <Route path="/community" element={<CommunityLeaguePage />} />
        <Route path="/community-league" element={<CommunityLeaguePage />} />
        <Route path="/app" element={<DownloadPage />} />
        <Route path="/scarica" element={<DownloadPage />} />
        <Route path="/download" element={<DownloadPage />} />
        <Route
          path="/admin/analytics"
          element={
            <Suspense fallback={<div className="min-h-screen bg-[#08122b]" />}>
              <AdminAnalytics />
            </Suspense>
          }
        />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
