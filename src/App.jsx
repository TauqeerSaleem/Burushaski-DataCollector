import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useUser } from "./context/UserContext";
import { useEffect } from "react";

import AuthRedirect from "./pages/AuthRedirect";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Consent from "./pages/Consent";
import Instructions from "./pages/Instructions";
import RoleDashboard from "./pages/RoleDashboard";
import ModuleView from "./pages/ModuleView";
import Stats from "./pages/Stats";
import VolunteerRoute from "./pages/VolunteerRoute";
import AdminLogin from "./pages/AdminLogin";
import AdminPanel from "./pages/AdminPanel";
import { syncPendingRecordings } from "./utils/syncRecordings";

export default function App() {
  const { loading } = useUser();
  const { user } = useUser();

  useEffect(() => {
    if (!user) return undefined;

    const flushPending = () => {
      if (!navigator.onLine) return;
      syncPendingRecordings().catch((error) => {
        console.error("Pending recording sync failed:", error);
      });
    };

    const handleOnline = () => {
      console.log("Back online");
      flushPending();
    };
    const handleVisible = () => {
      if (document.visibilityState === "visible") flushPending();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", flushPending);
    document.addEventListener("visibilitychange", handleVisible);

    flushPending();
    const syncTimer = window.setInterval(flushPending, 30000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", flushPending);
      document.removeEventListener("visibilitychange", handleVisible);
      window.clearInterval(syncTimer);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-500 flex items-center justify-center text-white">
        Loading…
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/consent" element={<Consent />} />
        <Route path="/instructions" element={<Instructions />} />
        <Route path="/dashboard" element={<RoleDashboard />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/module/:moduleId" element={<VolunteerRoute><ModuleView /></VolunteerRoute>} />
        <Route path="/stats" element={<VolunteerRoute><Stats /></VolunteerRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
