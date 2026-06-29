import { useEffect, useState, useRef } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:3001" : "");
const MAX_RECORDING_MS = 5 * 60 * 1000;

export default function FeedbackModal({
  open,
  onClose,
  onSubmit,
  sentenceNumber,
  sentenceId,
  participantId,
  moduleId,
}) {
  const [correctEnglish, setCorrectEnglish] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [recordingMessage, setRecordingMessage] = useState("");

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const recordingLimitTimerRef = useRef(null);
  const recordingStartedAtRef = useRef(null);
  const recordingDurationMsRef = useRef(0);

  useEffect(() => () => {
    if (recordingLimitTimerRef.current) clearTimeout(recordingLimitTimerRef.current);
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  if (!open) return null;

  // ── Recording helpers ──────────────────────────────────────────
  const startRecording = async () => {
    setError(null);
    setRecordingMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      mediaRecorder.start();
      recordingStartedAtRef.current = Date.now();
      setIsRecording(true);
      recordingLimitTimerRef.current = setTimeout(() => {
        recordingLimitTimerRef.current = null;
        recordingDurationMsRef.current = MAX_RECORDING_MS;
        setRecordingMessage("Recording stopped at the 5-minute limit. Submit what you recorded or restart.");
        stopRecording();
      }, MAX_RECORDING_MS);
    } catch {
      setError("Microphone access denied. Please allow microphone and try again.");
    }
  };

  const stopRecording = () => {
    if (recordingLimitTimerRef.current) {
      clearTimeout(recordingLimitTimerRef.current);
      recordingLimitTimerRef.current = null;
    }
    if (!recordingDurationMsRef.current && recordingStartedAtRef.current) {
      recordingDurationMsRef.current = Math.min(
        Date.now() - recordingStartedAtRef.current,
        MAX_RECORDING_MS
      );
    }
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const restartRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingMessage("");
    recordingStartedAtRef.current = null;
    recordingDurationMsRef.current = 0;
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!correctEnglish.trim() || !audioBlob) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/feedback-audio`, {
        method: "POST",
        headers: {
          "Content-Type": audioBlob.type || "audio/webm",
          "X-Participant-Id": participantId,
          "X-Module-Id": moduleId,
          "X-Sentence-Id": sentenceId,
          "X-Sentence-Number": String(sentenceNumber),
          "X-Correction": encodeURIComponent(correctEnglish.trim()),
          "X-Recording-Duration-Ms": String(recordingDurationMsRef.current),
        },
        body: audioBlob,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Feedback submission failed.");
      }

      onSubmit?.({
        sentenceNumber,
        correctEnglish: correctEnglish.trim(),
        audioUrl: data.feedback?.audioUrl,
      });

      setCorrectEnglish("");
      setAudioBlob(null);
      setAudioUrl(null);
      onClose();
    } catch (err) {
      console.error("Feedback submission error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = correctEnglish.trim() && audioBlob && !submitting;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl p-5 w-full max-w-md space-y-4 shadow-xl">

        {/* Header */}
        <div>
          <h2 className="text-lg font-bold">Report a correction</h2>
          <p className="text-sm text-gray-500 mt-1">
            Provide the correct transliteration and record that transliteration.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Sentence Number — read only */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Sentence Number
            </label>
            <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-gray-700 font-medium">
              {sentenceNumber}
            </div>
          </div>

          {/* Correct English Translation */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Correct Translation in English
            </label>
            <textarea
              placeholder="Type the correct English translation and Burushaski transliteration"
              value={correctEnglish}
              onChange={(e) => setCorrectEnglish(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
              rows={3}
              required
            />
          </div>

          {/* Record Correct Transliteration */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Record Correct Transliteration
            </label>

            {/* No recording yet */}
            {!audioUrl && (
              <div>
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition"
                  >
                    <span>🎙</span> Start Recording
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium animate-pulse"
                  >
                    <span>⏹</span> Stop Recording
                  </button>
                )}
              </div>
            )}

            {/* Playback */}
            {audioUrl && (
              <div className="space-y-2">
                {recordingMessage && <p className="text-sm text-amber-700">{recordingMessage}</p>}
                <audio controls src={audioUrl} className="w-full h-10" />
                <button
                  type="button"
                  onClick={restartRecording}
                  className="px-3 py-1 rounded bg-gray-200 text-sm font-medium text-gray-800"
                >
                  Restart
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition ${
                canSubmit
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
