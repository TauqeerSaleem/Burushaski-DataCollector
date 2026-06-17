import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { supabase } from "../utils/supabase";
import { buildPool, weightedRandomPick } from "../utils/randomizer";
import { useRecorder } from "../hooks/useRecorder";
import { uploadRecording } from "../utils/uploadRecording";

export default function Dashboard() {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const { isRecording, startRecording, stopRecording, resetRecording } = useRecorder();

  const [allSentences, setAllSentences] = useState(null);
  const [recordedIds, setRecordedIds] = useState([]);
  const [globalCounts, setGlobalCounts] = useState({});
  const [currentCard, setCurrentCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const audioUrlRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      setError("");

      const [
        { data: sentences, error: sErr },
        { data: myRecordings, error: rErr },
        { data: allRecordings, error: gErr },
      ] = await Promise.all([
        supabase.from("prompt_bank").select("*").eq("active", true),
        supabase
          .from("recordings")
          .select("sentence_id")
          .eq("participant_id", user.participantId),
        supabase.from("recordings").select("sentence_id"),
      ]);

      if (sErr || rErr || gErr) {
        setError((sErr || rErr || gErr).message);
        setLoading(false);
        return;
      }

      const counts = {};
      (allRecordings || []).forEach((r) => {
        counts[r.sentence_id] = (counts[r.sentence_id] || 0) + 1;
      });

      setAllSentences(sentences || []);
      setRecordedIds((myRecordings || []).map((r) => r.sentence_id));
      setGlobalCounts(counts);
      setLoading(false);
    };

    load();
  }, [user]);

  const pickNextCard = useCallback(() => {
    if (!allSentences) return;
    const pool = buildPool(allSentences, recordedIds, globalCounts, user.dialect);
    setCurrentCard(weightedRandomPick(pool));
  }, [allSentences, recordedIds, globalCounts, user]);

  useEffect(() => {
    if (allSentences) pickNextCard();
  }, [allSentences, recordedIds]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  // Auto-hide success message after a couple seconds
  useEffect(() => {
    if (!showSuccess) return;
    const timer = setTimeout(() => setShowSuccess(false), 2500);
    return () => clearTimeout(timer);
  }, [showSuccess]);

  const clearRecordingState = () => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setUploadError("");
    resetRecording();
  };

  const handleSkip = () => {
    clearRecordingState();
    pickNextCard();
  };

  const handleStartRecording = async () => {
    setUploadError("");
    try {
      await startRecording();
    } catch (err) {
      console.error("Could not start recording:", err);
      setUploadError("Could not access microphone. Check permissions and try again.");
    }
  };

  const handleStopRecording = async () => {
    const blob = await stopRecording();
    setAudioBlob(blob);

    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    setAudioUrl(url);
  };

  const handleReRecord = () => {
    clearRecordingState();
  };

  const handleSubmit = async () => {
    if (!audioBlob || !currentCard) return;

    setUploading(true);
    setUploadError("");

    try {
      await uploadRecording({
        blob: audioBlob,
        participantId: user.participantId,
        dialect: user.dialect,
        gender: user.gender,
        moduleId: currentCard.module_id,
        sentenceId: currentCard.prompt_id,
      });

      setRecordedIds((prev) => [...prev, currentCard.prompt_id]);
      setGlobalCounts((prev) => ({
        ...prev,
        [currentCard.prompt_id]: (prev[currentCard.prompt_id] || 0) + 1,
      }));

      clearRecordingState();
      setShowSuccess(true);
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadError("Upload failed. Please check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("hasSeenInstructions");
    navigate("/", { replace: true });
  };

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const totalForDialect = allSentences
    ? allSentences.filter((s) => s.active && s.dialect === user.dialect).length
    : 0;
  const recordedForDialect = allSentences
    ? allSentences.filter(
        (s) => s.active && s.dialect === user.dialect && recordedIds.includes(s.prompt_id)
      ).length
    : 0;

  return (
    <div className="safe-top p-4 space-y-4 min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <div className="flex justify-between items-center mb-2 gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-yellow-400 truncate min-w-0">
          Recording
        </h1>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate("/stats")}
            className="text-sm text-black font-bold bg-yellow-400 hover:bg-yellow-300 px-3 py-1 rounded"
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

      {/* Progress */}
      {allSentences && (
        <p className="text-sm text-gray-400">
          {recordedForDialect} / {totalForDialect} recorded
        </p>
      )}

      {/* Success message */}
      {showSuccess && (
        <div className="bg-green-100 text-green-800 rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2 max-w-2xl mx-auto">
          ✓ Recording saved
        </div>
      )}

      {/* Loading / error states */}
      {loading && <p className="text-gray-400">Loading sentences…</p>}
      {error && <p className="text-red-400">Error: {error}</p>}

      {/* Flashcard */}
      {!loading && !error && currentCard && (
        <div className="bg-white text-black rounded-3xl shadow-2xl p-10 md:p-14 space-y-8 max-w-2xl mx-auto min-h-[420px] flex flex-col justify-center">
          <div className="text-center space-y-4">
            <p className="text-base text-gray-500 italic">{currentCard.english}</p>
            <p className="text-3xl md:text-4xl font-bold leading-snug">{currentCard.transliteration}</p>
          </div>

          {uploadError && (
            <p className="text-sm text-red-600 text-center">{uploadError}</p>
          )}

          {/* Step 1: nothing recorded yet — show Record + Skip */}
          {!audioBlob && !isRecording && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleStartRecording}
                className="flex-1 bg-black text-white py-4 rounded-xl font-semibold text-lg"
              >
                🎙️ Record
              </button>
              <button
                onClick={handleSkip}
                className="px-6 py-4 rounded-xl font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                Skip
              </button>
            </div>
          )}

          {/* Step 2: currently recording — show Stop */}
          {isRecording && (
            <button
              onClick={handleStopRecording}
              className="w-full bg-red-600 text-white py-4 rounded-xl font-semibold text-lg"
            >
              ⏹️ Stop
            </button>
          )}

          {/* Step 3: recorded, reviewing — show playback + Re-record/Submit */}
          {audioBlob && !isRecording && (
            <div className="space-y-4">
              <audio src={audioUrl} controls className="w-full" />

              <div className="flex gap-3">
                <button
                  onClick={handleReRecord}
                  disabled={uploading}
                  className="flex-1 bg-gray-200 text-gray-700 py-4 rounded-xl font-semibold hover:bg-gray-300 disabled:opacity-50"
                >
                  Re-record
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={uploading}
                  className="flex-1 bg-yellow-400 text-black py-4 rounded-xl font-semibold hover:bg-yellow-300 disabled:opacity-50"
                >
                  {uploading ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Done state */}
      {!loading && !error && !currentCard && allSentences && (
        <div className="bg-white text-black rounded-3xl shadow-2xl p-10 text-center max-w-2xl mx-auto">
          <p className="text-lg font-semibold">🎉 All sentences recorded!</p>
          <p className="text-gray-500 text-sm mt-1">
            Check back later for new sentences.
          </p>
        </div>
      )}
    </div>
  );
}