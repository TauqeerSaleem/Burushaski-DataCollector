import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useUser } from "./context/UserContext";
import { useEffect } from "react";

import Onboarding from "./pages/Onboarding";
import Instructions from "./pages/Instructions";
import RoleDashboard from "./pages/RoleDashboard";
import ModuleView from "./pages/ModuleView";
import Stats from "./pages/Stats";
import VolunteerRoute from "./pages/VolunteerRoute";
import { syncPendingRecordings } from "./utils/syncRecordings";
import { registerSW } from 'virtual:pwa-register';

// Register the service worker when the app loads

export default function App() {
  const { loading } = useUser();
  useEffect(() => {
  registerSW();  // Automatically registers the service worker
}, []);

const { user } = useUser();

useEffect(() => {
  const handleOnline = () => {
    console.log("🌐 Back online");
    syncPendingRecordings(user);
  };

  window.addEventListener("online", handleOnline);

  // Run once on app start
  if (user) {
    syncPendingRecordings(user);
  }

  return () => {
    window.removeEventListener("online", handleOnline);
  };
}, [user]);



  // Wait until user is loaded from localStorage
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
        <Route path="/" element={<Onboarding />} />
        <Route path="/instructions" element={<Instructions />} />
        <Route path="/dashboard" element={<RoleDashboard />} />
        <Route path="/module/:moduleId" element={<VolunteerRoute><ModuleView /></VolunteerRoute>} />
        <Route path="/stats" element={<VolunteerRoute><Stats /></VolunteerRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
