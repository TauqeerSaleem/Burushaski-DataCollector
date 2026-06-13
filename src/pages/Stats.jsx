import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useSentences } from "../hooks/useSentences";
import { db } from "../db/indexdb";
import { useUser } from "../context/UserContext";

export default function Stats() {
  const data = useSentences();
  const { user } = useUser();
  const navigate = useNavigate();

  const [completedMap, setCompletedMap] = useState({});
  const [uploadedMap, setUploadedMap] = useState({});
  const [loaded, setLoaded] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  useEffect(() => {
    if (!data || !user) return;

    const load = async () => {
      const rows = await db.recordings
        .where({ participantId: user.participantId })
        .toArray();

      const completed = {};
      const uploaded = {};
      rows.forEach((r) => {
        completed[r.moduleId] = (completed[r.moduleId] || 0) + 1;
        if (r.status === "uploaded") {
          uploaded[r.moduleId] = (uploaded[r.moduleId] || 0) + 1;
        }
      });

      setCompletedMap(completed);
      setUploadedMap(uploaded);
      setLoaded(true);
    };

    load();
  }, [data, user]);

  if (!data || !loaded) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-400 text-sm">Loading your stats…</p>
        </div>
      </div>
    );
  }

  // ── Aggregate numbers ──────────────────────────────────────
  const totalModules = data.modules.length;
  const totalSentences = data.modules.reduce((s, m) => s + m.sentences.length, 0);
  const totalRecorded = Object.values(completedMap).reduce((s, n) => s + n, 0);
  const totalUploaded = Object.values(uploadedMap).reduce((s, n) => s + n, 0);
  const completedModules = data.modules.filter((m) => {
    const done = completedMap[m.moduleId] || 0;
    return done >= m.sentences.length;
  }).length;
  const overallPct = totalSentences === 0 ? 0 : Math.round((totalRecorded / totalSentences) * 100);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-neutral-950/90 backdrop-blur border-b border-neutral-800 px-4 py-3">
        <h1 className="text-base font-semibold text-yellow-400 tracking-wide text-center">
          Your Progress
        </h1>
      </div>

      <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="w-full bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-black font-bold py-3.5 rounded-xl text-sm transition-all touch-manipulation"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          Go to Dashboard
        </button>

        {/* ── Big ring + greeting ── */}
        <div className="flex items-center gap-5 bg-neutral-900 rounded-2xl p-5 border border-neutral-800">
          <Ring pct={overallPct} />
          <div>
            <p className="text-2xl font-bold text-white">{overallPct}%</p>
            <p className="text-neutral-400 text-sm mt-0.5">overall complete</p>
            <p className="text-yellow-400 text-xs mt-2 font-medium">
              {user.participantId} · {user.dialect} · {user.gender}
            </p>
          </div>
        </div>

        {/* ── Summary chips ── */}
        <div className="grid grid-cols-2 gap-3">
          <Chip label="Sentences recorded" value={totalRecorded} total={totalSentences} color="yellow" />
          <Chip label="Uploaded to server" value={totalUploaded} total={totalRecorded} color="green" />
          <Chip label="Modules started" value={Object.keys(completedMap).length} total={totalModules} color="blue" />
          <Chip label="Modules completed" value={completedModules} total={totalModules} color="orange" />
        </div>

        {/* ── Per-module breakdown ── */}
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-3 font-semibold">Module breakdown</p>
          <div className="space-y-2">
            {data.modules.map((module) => {
              const done = completedMap[module.moduleId] || 0;
              const total = module.sentences.length;
              const pct = total === 0 ? 0 : Math.round((done / total) * 100);
              const isComplete = done >= total && total > 0;

              return (
                <div
                  key={module.moduleId}
                  className="bg-neutral-900 rounded-xl px-4 py-3 border border-neutral-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white font-medium truncate pr-2">{module.title}</span>
                    <span className={`text-xs font-semibold shrink-0 ${isComplete ? "text-green-400" : "text-neutral-400"}`}>
                      {isComplete ? "✓ done" : `${done}/${total}`}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${isComplete ? "bg-green-400" : "bg-yellow-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── SVG ring ──────────────────────────────────────────────────
function Ring({ pct }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <svg width="80" height="80" viewBox="0 0 80 80" className="shrink-0 -rotate-90">
      <circle cx="40" cy="40" r={r} fill="none" stroke="#262626" strokeWidth="8" />
      <circle
        cx="40" cy="40" r={r}
        fill="none"
        stroke="#facc15"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
    </svg>
  );
}

// ── Summary chip ─────────────────────────────────────────────
const colorMap = {
  yellow: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  green:  "text-green-400  bg-green-400/10  border-green-400/20",
  blue:   "text-blue-400   bg-blue-400/10   border-blue-400/20",
  orange: "text-orange-400 bg-orange-400/10 border-orange-400/20",
};

function Chip({ label, value, total, color }) {
  return (
    <div className={`rounded-xl p-4 border ${colorMap[color]} space-y-1`}>
      <p className="text-2xl font-bold">{value}<span className="text-sm font-normal opacity-60">/{total}</span></p>
      <p className="text-xs opacity-70 leading-tight">{label}</p>
    </div>
  );
}
