import { useRecorder } from "../hooks/useRecorder";
import { db } from "../db/indexdb";
import { useUser } from "../context/UserContext";
import { useEffect, useRef, useState } from "react";
import { syncPendingRecordings } from "../utils/syncRecordings";
import FeedbackModal from "./FeedbackModal";

const MAX_RECORDING_MS = 5 * 60 * 1000;

export default function SentenceCard({
  sentence,
  index,
  moduleId,
  isCompleted,
  onSubmitted,
}) {
  const { user } = useUser();

  const {
    isRecording,
    startRecording,
    stopRecording,
  } = useRecorder();

  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [status, setStatus] = useState(null); // pending | synced
  const [showFeedback, setShowFeedback] = useState(false);
  const [recordingMessage, setRecordingMessage] = useState("");
  const recordingLimitTimerRef = useRef(null);
  const recordingStartedAtRef = useRef(null);
  const recordingDurationMsRef = useRef(0);

  const isRecorded = isCompleted;

  // 🔁 Re-read status from IndexedDB
  useEffect(() => {
    const load = async () => {
      const record = await db.recordings
        .where({
          participantId: user.participantId,
          moduleId,
          sentenceId: sentence.sentenceId,
        })
        .last();

      if (record?.status) {
        setStatus(record.status);
      }
    };

    load();
  }, [moduleId, sentence.sentenceId, user.participantId]);

  useEffect(() => () => {
    if (recordingLimitTimerRef.current) clearTimeout(recordingLimitTimerRef.current);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const handleStart = async () => {
    setRecordingMessage("");
    await startRecording();
    recordingStartedAtRef.current = Date.now();
    recordingLimitTimerRef.current = setTimeout(async () => {
      recordingLimitTimerRef.current = null;
      recordingDurationMsRef.current = MAX_RECORDING_MS;
      const blob = await stopRecording();
      if (blob) {
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setRecordingMessage("Recording stopped at the 5-minute limit. Submit what you recorded or restart.");
      }
    }, MAX_RECORDING_MS);
  };

  const handleStop = async () => {
    if (recordingLimitTimerRef.current) {
      clearTimeout(recordingLimitTimerRef.current);
      recordingLimitTimerRef.current = null;
    }
    recordingDurationMsRef.current = recordingStartedAtRef.current
      ? Math.min(Date.now() - recordingStartedAtRef.current, MAX_RECORDING_MS)
      : 0;
    const blob = await stopRecording();
    if (blob) {
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
    }
  };

  const restart = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingMessage("");
    recordingStartedAtRef.current = null;
    recordingDurationMsRef.current = 0;
  };

  // 🎙 Submit recording
  const submit = async () => {
    if (!audioBlob || isRecorded) return;

    await db.recordings.add({
      participantId: user.participantId,
      dialect: user.dialect,
      moduleId,
      sentenceId: sentence.sentenceId,
      audioBlob,
      status: "pending",
      durationMs: recordingDurationMsRef.current,
      createdAt: new Date(),
    });

    setStatus("pending");
    onSubmitted(sentence.sentenceId);

    if (navigator.onLine) {
      syncPendingRecordings(user);
    }
  };

  return (
    <>
      <div
        className={`border p-4 rounded space-y-2 transition ${
          isRecorded
            ? "bg-gray-100 opacity-60 pointer-events-none"
            : "bg-white"
        }`}
      >
        {/* Sentence number + English */}
        <p className="font-semibold">
          {index + 1}. {sentence.english}
        </p>

        {/* Transliteration */}
        <p className="text-2xl font-black text-black tracking-wide">
          {sentence.transliteration}
        </p>

        {/* 📝 Report issue — only when not yet recorded */}
        {!isRecorded && (
          <button
            onClick={() => setShowFeedback(true)}
            className="text-xs text-blue-600 underline"
          >
            Suggest Correction Here!
          </button>
        )}

        {/* 🎙 Recording controls */}
        {!isRecorded && !audioUrl && (
          <div className="space-x-2">
            {!isRecording ? (
              <button
                onClick={handleStart}
                className="px-3 py-1 bg-black text-white rounded"
              >
                Record
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="px-3 py-1 bg-red-600 text-white rounded"
              >
                Stop
              </button>
            )}
          </div>
        )}

        {/* 🎧 Playback */}
        {!isRecorded && audioUrl && (
          <div className="space-y-2">
            {recordingMessage && <p className="text-sm text-amber-700">{recordingMessage}</p>}
            <audio controls src={audioUrl} />
            <div className="space-x-2">
              <button
                onClick={submit}
                className="px-3 py-1 bg-green-600 text-white rounded"
              >
                Submit
              </button>
              <button
                onClick={restart}
                className="px-3 py-1 bg-gray-200 text-gray-800 rounded"
              >
                Restart
              </button>
            </div>
          </div>
        )}

        {/* ✅ Completed status */}
        {isRecorded && (
          <>
            <p className="text-green-700 font-semibold">✓ Submitted</p>
            {status === "pending" && (
              <span className="text-xs text-yellow-600 block">
                Saved offline • Will upload later
              </span>
            )}
            {status === "synced" && (
              <span className="text-xs text-green-600 block">
                Uploaded successfully
              </span>
            )}
          </>
        )}
      </div>

      {/* 🪟 Feedback Modal */}
      {showFeedback && (
        <FeedbackModal
          open={showFeedback}
          onClose={() => setShowFeedback(false)}
          sentenceNumber={index + 1}
          sentenceId={sentence.sentenceId}
          participantId={user.participantId}
          moduleId={moduleId}
        />
      )}
    </>
  );
}
