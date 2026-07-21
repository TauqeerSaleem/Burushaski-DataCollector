import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useUser } from "./context/UserContext";
import { useCallback, useEffect, useState } from "react";

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
import { db } from "./db/indexdb";

export default function App() {
  const { loading } = useUser();
  const { user } = useUser();
  const participantId = user?.participantId || "";
  const [pendingSummary, setPendingSummary] = useState({
    pending: 0,
    failed: 0,
    syncing: false,
    lastError: "",
  });

  const refreshPendingSummary = useCallback(async () => {
    if (!participantId) return;
    const [pendingRows, failedRows] = await Promise.all([
      db.recordings
        .where("status")
        .equals("pending")
        .and((recording) => recording.participantId === participantId)
        .toArray(),
      db.recordings
        .where("status")
        .equals("failed")
        .and((recording) => recording.participantId === participantId)
        .toArray(),
    ]);

    setPendingSummary((current) => ({
      ...current,
      pending: pendingRows.length,
      failed: failedRows.length,
      lastError: pendingRows.find((recording) => recording.lastError)?.lastError || failedRows[0]?.lastError || current.lastError || "",
    }));
  }, [participantId]);

  useEffect(() => {
    if (!user) return undefined;

    const flushPending = () => {
      if (!navigator.onLine) return;
      setPendingSummary((current) => ({ ...current, syncing: true, lastError: "" }));
      syncPendingRecordings(participantId)
        .catch((error) => {
          console.error("Pending recording sync failed:", error);
          setPendingSummary((current) => ({
            ...current,
            lastError: error.message || "Pending recording sync failed.",
          }));
        })
        .finally(() => {
          refreshPendingSummary()
            .catch((error) => console.error("Pending recording status check failed:", error))
            .finally(() => setPendingSummary((current) => ({ ...current, syncing: false })));
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
    const initialStatusTimer = window.setTimeout(() => {
      refreshPendingSummary().catch((error) => console.error("Pending recording status check failed:", error));
    }, 0);
    const syncTimer = window.setInterval(flushPending, 30000);
    const statusTimer = window.setInterval(() => {
      refreshPendingSummary().catch((error) => console.error("Pending recording status check failed:", error));
    }, 10000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", flushPending);
      document.removeEventListener("visibilitychange", handleVisible);
      window.clearTimeout(initialStatusTimer);
      window.clearInterval(syncTimer);
      window.clearInterval(statusTimer);
    };
  }, [participantId, refreshPendingSummary, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-500 flex items-center justify-center text-white">
        Loading…
      </div>
    );
  }

  return (
    <BrowserRouter>
      {participantId && (pendingSummary.pending > 0 || pendingSummary.failed > 0) && (
        <div className="fixed inset-x-0 bottom-0 z-[1000] border-t border-yellow-500/40 bg-neutral-950 px-4 py-3 text-sm text-white shadow-2xl">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            <span>
              {pendingSummary.pending > 0
                ? `${pendingSummary.pending} recording${pendingSummary.pending === 1 ? "" : "s"} saved on this device, waiting to upload.`
                : "Some local recordings need attention."}
              {pendingSummary.lastError ? ` ${pendingSummary.lastError}` : ""}
            </span>
            <button
              type="button"
              onClick={() => {
                setPendingSummary((current) => ({ ...current, syncing: true, lastError: "" }));
                syncPendingRecordings(participantId)
                  .catch((error) =>
                    setPendingSummary((current) => ({
                      ...current,
                      lastError: error.message || "Pending recording sync failed.",
                    }))
                  )
                  .finally(() => {
                    refreshPendingSummary()
                      .catch((error) => console.error("Pending recording status check failed:", error))
                      .finally(() => setPendingSummary((current) => ({ ...current, syncing: false })));
                  });
              }}
              disabled={pendingSummary.syncing || !navigator.onLine}
              className="rounded bg-yellow-400 px-3 py-1.5 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingSummary.syncing ? "Uploading..." : navigator.onLine ? "Upload now" : "Offline"}
            </button>
          </div>
        </div>
      )}
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
