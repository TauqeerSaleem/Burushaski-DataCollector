import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSentences } from "../hooks/useSentences";
import SentenceCard from "../Components/SentenceCard";
import { db } from "../db/indexdb";
import { useUser } from "../context/UserContext";
import ProgressBar from "../Components/ProgressBar";

export default function ModuleView() {
  const params = useParams();
  const moduleId = params?.moduleId;
  const navigate = useNavigate();
  const data = useSentences();
  const { user, loading } = useUser();
  const [completed, setCompleted] = useState([]);

  // Fetch completed recordings from IndexedDB
  useEffect(() => {
    if (!user?.participantId) return;

    db.recordings
      .where({ participantId: user.participantId, moduleId })
      .toArray()
      .then((rows) => setCompleted(rows.map((r) => r.sentenceId)))
      .catch((err) => {
        console.error("Error loading completed recordings:", err);
      });
  }, [moduleId, user?.participantId]);

  // Route guard
  if (!moduleId) {
    return <div className="p-6 text-white">Invalid module URL</div>;
  }

  if (loading || !data) {
    return <div className="p-6 text-white">Loading...</div>;
  }

  const module = data.modules.find((m) => m.moduleId === moduleId);

  if (!module) {
    return <div className="p-6 text-white">Module not found</div>;
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="p-6 space-y-4">

        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate("/dashboard", { replace: true })}
          className="flex items-center justify-center gap-3 w-full
                     bg-yellow-400/10 hover:bg-yellow-400/20 
                     text-yellow-400 font-bold text-base
                     py-4 px-6 rounded-xl
                     border-2 border-yellow-400/30
                     relative z-50 
                     touch-manipulation active:scale-95 
                     transition-all duration-200 shadow-lg"
          style={{
            WebkitTapHighlightColor: "transparent",
            minHeight: "56px",
            touchAction: "manipulation",
          }}
          aria-label="Back to Dashboard"
        >
          <span className="text-2xl">←</span>
          <span>Back to Dashboard</span>
        </button>

        <h1 className="text-xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
          {module.title}
        </h1>

        {/* Progress Bar */}
        <ProgressBar
          completed={completed.length}
          total={module.sentences.length}
        />

        {/* Sentence cards */}
        {module.sentences.map((sentence, index) => (
          <SentenceCard
            key={sentence.sentenceId}
            sentence={sentence}
            index={index}
            moduleId={moduleId}
            isCompleted={completed.includes(sentence.sentenceId)}
            onSubmitted={(sid) =>
              setCompleted((prev) => [...prev, sid])
            }
          />
        ))}
      </div>
    </div>
  );
}
