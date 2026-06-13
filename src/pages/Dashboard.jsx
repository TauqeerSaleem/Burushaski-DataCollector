import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useSentences } from "../hooks/useSentences";
import { db } from "../db/indexdb";
import { useUser } from "../context/UserContext";
import ProgressBar from "../Components/ProgressBar";
import ReminderBanner from "../Components/ReminderBanner";
import { requestNotificationPermission } from "../hooks/useNotifications";
import { sendReminderNotification } from "../utils/notify";

export default function Dashboard() {
  const data = useSentences();
  const { user, setUser } = useUser();
  const navigate = useNavigate();

  // 🔐 AUTH GUARD — must be first
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const [completedMap, setCompletedMap] = useState({});

  // 🔄 Load progress from IndexedDB
  useEffect(() => {
    if (!data || !user) return;

    const loadProgress = async () => {
      const rows = await db.recordings
        .where({ participantId: user.participantId })
        .toArray();

      const map = {};
      rows.forEach((r) => {
        map[r.moduleId] = (map[r.moduleId] || 0) + 1;
      });

      setCompletedMap(map);
    };

    loadProgress();
  }, [data, user]);

  if (!data) return <p className="p-4">Loading…</p>;

  // 🔔 REMINDER LOGIC
  let reminderMessage = null;

  const incompleteModules = data.modules.filter((module) => {
    const completed = completedMap[module.moduleId] || 0;
    return completed < module.sentences.length;
  });

  if (incompleteModules.length > 0) {
    const mod = incompleteModules[0];
    const completed = completedMap[mod.moduleId] || 0;
    const remaining = mod.sentences.length - completed;

    reminderMessage = `You have ${remaining} sentences left in "${mod.title}".`;
  }

  // 🔔 Browser notification (fire once every 6 hours)
  useEffect(() => {
    if (!reminderMessage) return;

    const LAST_KEY = "last_reminder_sent";
    const now = Date.now();
    const lastSent = localStorage.getItem(LAST_KEY);

    const SIX_HOURS = 6 * 60 * 60 * 1000;

    if (!lastSent || now - Number(lastSent) > SIX_HOURS) {
      requestNotificationPermission().then((granted) => {
        if (!granted) return;

        sendReminderNotification(
          "Burushaski Recording Reminder",
          reminderMessage
        );

        localStorage.setItem(LAST_KEY, now.toString());
      });
    }
  }, [reminderMessage]);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("hasSeenInstructions");
    navigate("/", { replace: true });
  };

  // ✅ JSX MUST BE RETURNED
  return (
    <div className="safe-top p-4 space-y-4">
      {/* Header with Instructions Link */}
      <div className="flex justify-between items-center mb-2 gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-yellow-400 truncate min-w-0">
          Recording Modules
        </h1>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate("/stats")}
            className="text-sm text-black font-bold bg-yellow-400 hover:bg-yellow-300 px-3 py-1 rounded active:scale-95 transition-all touch-manipulation"
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            Show stats
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("hasSeenInstructions");
              navigate("/instructions");
            }}
            className="text-sm text-white font-bold bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded"
          >
            📖 View Instructions
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-white font-bold bg-red-600 hover:bg-red-700 px-3 py-1 rounded"
          >
            Logout
          </button>
        </div>
      </div>

      {reminderMessage && (
        <ReminderBanner message={reminderMessage} />
      )}

      {data.modules.map((module) => {
        const completed = completedMap[module.moduleId] || 0;
        const total = module.sentences.length;
        const isCompleted = total > 0 && completed === total;

        return (
          <div
            key={module.moduleId}
            onClick={() => {
              if (isCompleted) return;
              navigate(`/module/${module.moduleId}`);
            }}
            className={`border p-4 rounded space-y-2 ${
              isCompleted
                ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                : "bg-white cursor-pointer hover:bg-gray-100"
            }`}
          >
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">{module.title}</h2>

              {isCompleted && (
                <span className="text-green-700 font-semibold text-sm">
                  ✓ Completed
                </span>
              )}
            </div>

            <ProgressBar completed={completed} total={total} small />
          </div>
        );
      })}
    </div>
  );
}