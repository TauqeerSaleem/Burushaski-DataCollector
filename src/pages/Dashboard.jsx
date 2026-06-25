import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { pickNextPrompt } from "../utils/randomizer";
import { useRecorder } from "../hooks/useRecorder";
import { uploadRecording } from "../utils/uploadRecording";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:3001" : "");

export default function Dashboard() {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const { isRecording, startRecording, stopRecording, resetRecording } = useRecorder();

  const [allSentences, setAllSentences] = useState(null);
  const [recordedIds, setRecordedIds] = useState([]);
  const [globalCounts, setGlobalCounts] = useState({});
  const [currentCard, setCurrentCard] = useState(null);
  const [pickCount, setPickCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [englishTranslation, setEnglishTranslation] = useState("");
  const [correctionFlag, setCorrectionFlag] = useState(false);
  const [suggestedCorrection, setSuggestedCorrection] = useState("");
  const audioUrlRef = useRef(null);
  const [allValidationTasks, setAllValidationTasks] = useState([]);
  const [validatedIds, setValidatedIds] = useState([]);
  const [globalValidationCounts, setGlobalValidationCounts] = useState({});
  const [validationVoting, setValidationVoting] = useState(false);
  const [validationError, setValidationError] = useState("");


  useEffect(() => {
    if (!user) return;

const load = async () => {
  setLoading(true);
  setError("");

  try {
    const params = new URLSearchParams({
      dialect: user.dialect || "",
      participantId: user.participantId || "",
    });

    const [dashRes, validationRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/volunteer-dashboard?${params}`),
      fetch(`${API_BASE_URL}/api/validation-tasks?${params}`),
    ]);

    const dashData = await dashRes.json().catch(() => ({}));
    const validationData = await validationRes.json().catch(() => ({}));

    if (!dashRes.ok) throw new Error(dashData.error || "Could not load recording prompts.");

    setAllSentences(dashData.prompts || []);
    setRecordedIds(dashData.recordedIds || []);
    setGlobalCounts(dashData.globalCounts || {});
    setAllValidationTasks((validationData.tasks || []).filter(t => t.participantId !== user.participantId));
    setValidatedIds(validationData.validatedIds || []);
    setGlobalValidationCounts(validationData.globalValidationCounts || {});
  } catch (err) {
    setError(err.message || "Could not load recording prompts.");
  } finally {
    setLoading(false);
  }
};

    load();
  }, [user]);

  const pickNextCard = useCallback((currentPickCount) => {
    if (!allSentences) return;
    const next = pickNextPrompt(
      allSentences, recordedIds, globalCounts, user.dialect,
      allValidationTasks, validatedIds, globalValidationCounts,
      currentPickCount
    );
    setCurrentCard(next);
    setPickCount(currentPickCount + 1);
  }, [allSentences, recordedIds, globalCounts, user, allValidationTasks, validatedIds, globalValidationCounts]);

  useEffect(() => {
    if (allSentences) pickNextCard(0);
  }, [allSentences]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!showSuccess) return;
    const timer = setTimeout(() => setShowSuccess(false), 2500);
    return () => clearTimeout(timer);
  }, [showSuccess]);

  const handleValidationVote = async (vote) => {
  if (!currentCard || validationVoting) return;
  setValidationVoting(true);
  setValidationError("");

  try {
    const res = await fetch(`${API_BASE_URL}/api/validations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordingId: currentCard.id,
        participantId: user.participantId,
        vote,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not submit vote.");

    // Mark as validated locally
    setValidatedIds((prev) => [...prev, currentCard.id]);
    setGlobalValidationCounts((prev) => ({
      ...prev,
      [currentCard.id]: (prev[currentCard.id] || 0) + 1,
    }));

    pickNextCard(pickCount);
  } catch (err) {
    setValidationError(err.message);
  } finally {
    setValidationVoting(false);
  }
};

  const clearRecordingState = () => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setUploadError("");
    setTranscript("");
    setEnglishTranslation("");
    setCorrectionFlag(false);
    setSuggestedCorrection("");
    resetRecording();
  };

  const handleSkip = () => {
    clearRecordingState();
    pickNextCard(pickCount);
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

  const handleSubmit = async () => {
    if (!audioBlob || !currentCard || uploading) return;
    if (correctionFlag && !suggestedCorrection.trim()) {
      setUploadError("Add the corrected English translation, or uncheck the correction box.");
      return;
    }

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
        transcript,
        englishTranslation: currentCard.prompt_type === "picture_description" ? englishTranslation : "",
        correctionFlag,
        suggestedCorrection,
      });

      setRecordedIds((prev) => [...prev, currentCard.prompt_id]);
      setGlobalCounts((prev) => ({
        ...prev,
        [currentCard.prompt_id]: (prev[currentCard.prompt_id] || 0) + 1,
      }));

      clearRecordingState();
      setShowSuccess(true);
      pickNextCard(pickCount);
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
  ? allSentences.filter((s) => s.active && (!s.dialect || s.dialect === user.dialect || s.dialect === "all")).length
  : 0;
const recordedForDialect = allSentences
  ? allSentences.filter(
      (s) => s.active && (!s.dialect || s.dialect === user.dialect || s.dialect === "all") && recordedIds.includes(s.prompt_id)
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
      {!loading && !error && currentCard && currentCard._cardType !== "validation" && (
        <div className="bg-white text-black rounded-3xl shadow-2xl p-10 md:p-14 space-y-8 max-w-2xl mx-auto min-h-[420px] flex flex-col justify-center">
          <div className="text-center space-y-4">
  {currentCard.media_type === "image" && currentCard.media_url && (
    <img
      src={currentCard.media_url}
      alt=""
      className="mx-auto max-h-64 w-full rounded-2xl object-contain bg-gray-100"
    />
  )}

  {currentCard.prompt_type === "picture_description" ? (
    <p className="font-bold text-2xl leading-relaxed">
      {currentCard.english}
    </p>
  ) : (
    <>
      <p className="text-sm text-gray-500">
        Can you translate this into Burushaski?
      </p>
      <p className="font-bold text-3xl leading-relaxed">
        "{currentCard.english}"
      </p>
    </>
  )}

  {currentCard.transliteration && currentCard.prompt_type !== "picture_description" && (
    <details className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-center inline-block mx-auto">
<summary className="cursor-pointer text-xs font-semibold text-gray-500">
  Show suggested translation
</summary>
      <p className="text-sm text-gray-600 italic mt-2">{currentCard.transliteration}</p>
    </details>
  )}
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

{/* Step 3: recorded, reviewing — show playback + Submit */}
          {audioBlob && !isRecording && (
            <div className="space-y-4">
              <audio src={audioUrl} controls className="w-full" />

              {/* Text prompt optional transcript/correction */}
              {currentCard.prompt_type !== "picture_description" && (
                <details className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-left">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                    Add optional transcript or correction
                  </summary>
                  <div className="mt-3 space-y-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        What you said
                      </span>
                      <textarea
                        className="w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-yellow-500"
                        rows={2}
                        value={transcript}
                        onChange={(event) => setTranscript(event.target.value)}
                        placeholder="Optional Burushaski transcript"
                      />
                    </label>

                    <label className="flex items-start gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={correctionFlag}
                        onChange={(event) => setCorrectionFlag(event.target.checked)}
                      />
                      <span>The suggested English is not how I would naturally or correctly say it.</span>
                    </label>

                    {correctionFlag && (
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Better English translation
                        </span>
                        <textarea
                          className="w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-yellow-500"
                          rows={2}
                          value={suggestedCorrection}
                          onChange={(event) => setSuggestedCorrection(event.target.value)}
                          placeholder="Write the better translation"
                        />
                      </label>
                    )}
                  </div>
                </details>
              )}

              {/* Image prompt optional transcript/translation */}
              {currentCard.media_type === "image" && (
                <details className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-left">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                    Add optional transcript or translation
                  </summary>
                  <div className="mt-3 space-y-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        What you said (Burushaski transcript)
                      </span>
                      <textarea
                        className="w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-yellow-500"
                        rows={2}
                        value={transcript}
                        onChange={(event) => setTranscript(event.target.value)}
                        placeholder="Optional Burushaski transcript"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        English translation (optional)
                      </span>
                      <textarea
                        className="w-full rounded-xl border border-gray-300 p-3 text-sm outline-none focus:border-yellow-500"
                        rows={2}
                        value={englishTranslation}
                        onChange={(event) => setEnglishTranslation(event.target.value)}
                        placeholder="Optional English translation of what you said"
                      />
                    </label>
                  </div>
                </details>
              )}

              <div className="flex gap-3">
                <button
                  onClick={clearRecordingState}
                  disabled={uploading}
                  className="px-6 py-4 rounded-xl font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                >
                  Re-record
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={uploading || (correctionFlag && !suggestedCorrection.trim())}
                  className="flex-1 bg-yellow-400 text-black py-4 rounded-xl font-semibold hover:bg-yellow-300 disabled:opacity-50"
                >
                  {uploading ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Validation card */}
{!loading && !error && currentCard?._cardType === "validation" && (
  <div className="bg-white text-black rounded-3xl shadow-2xl p-10 md:p-14 space-y-8 max-w-2xl mx-auto min-h-[420px] flex flex-col justify-center">
    <div className="text-center space-y-2">
      <p className="text-sm text-gray-500">
        The volunteer was asked to say:
      </p>
      <p className="text-2xl font-bold leading-snug">"{currentCard.english}"</p>
    </div>

    <audio src={currentCard.audioUrl} controls className="w-full" />

    <p className="text-center text-sm text-gray-600 font-medium">
      Does this recording accurately say the sentence above?
    </p>

    {validationError && (
      <p className="text-sm text-red-600 text-center">{validationError}</p>
    )}

    <div className="flex gap-3">
      <button
        onClick={() => handleValidationVote(-1)}
        disabled={validationVoting}
        className="flex-1 bg-red-100 text-red-700 py-4 rounded-xl font-semibold hover:bg-red-200 disabled:opacity-50 text-lg"
      >
        ✗ No
      </button>
      <button
        onClick={() => handleValidationVote(1)}
        disabled={validationVoting}
        className="flex-1 bg-green-100 text-green-700 py-4 rounded-xl font-semibold hover:bg-green-200 disabled:opacity-50 text-lg"
      >
        ✓ Yes
      </button>
    </div>

    <button
      onClick={() => pickNextCard(pickCount)}
      disabled={validationVoting}
      className="text-sm text-gray-400 hover:text-gray-600 text-center"
    >
      Skip this validation →
    </button>
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