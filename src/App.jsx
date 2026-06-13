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
import { syncPendingRecordings } from "./utils/syncRecordings";
import { registerSW } from 'virtual:pwa-register';

export default function App() {
  const { loading } = useUser();
  useEffect(() => {
    registerSW();
  }, []);

  const { user } = useUser();

  useEffect(() => {
    const handleOnline = () => {
      console.log("🌐 Back online");
      syncPendingRecordings(user);
    };

    window.addEventListener("online", handleOnline);

    if (user) {
      syncPendingRecordings(user);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
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
        <Route path="/module/:moduleId" element={<VolunteerRoute><ModuleView /></VolunteerRoute>} />
        <Route path="/stats" element={<VolunteerRoute><Stats /></VolunteerRoute>} />
      </Routes>
    </BrowserRouter>
  );
}