import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Privacy from "./pages/Privacy";
import Login from "./pages/Login";
import Register from "./pages/Register";
import LeaguePage from "./pages/LeaguePage";
import DownloadPage from "./pages/DownloadPage";
import CommunityLeaguePage from "./pages/CommunityLeaguePage";
import AdminAnalytics from "./pages/AdminAnalytics";

export default function App() {
  return (
    <BrowserRouter>
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
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
