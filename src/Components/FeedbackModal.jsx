import { useState, useRef } from "react";
import { supabase } from "../utils/supabase";

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

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  if (!open) return null;

  // ── Recording helpers ──────────────────────────────────────────
  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      setError("Microphone access denied. Please allow microphone and try again.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!correctEnglish.trim() || !audioBlob) return;

    setSubmitting(true);
    setError(null);

    try {
      // 1. Upload audio to Supabase Storage
      const fileName = `feedback_${participantId}_${moduleId}_s${sentenceNumber}_${Date.now()}.webm`;

      const { error: uploadError } = await supabase.storage
        .from("feedback-audio")
        .upload(fileName, audioBlob, { contentType: "audio/webm" });

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from("feedback-audio")
        .getPublicUrl(fileName);

      const audioPublicUrl = urlData?.publicUrl ?? null;

      // 3. Insert row into feedback table
      const { error: insertError } = await supabase.from("feedback").insert({
        participant_id: participantId,
        module_id: moduleId,
        sentence_id: sentenceId,
        sentence_number: sentenceNumber,
        correct_english: correctEnglish.trim(),
        audio_url: audioPublicUrl,
        created_at: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      // 4. Notify parent + close
      onSubmit?.({
        sentenceNumber,
        correctEnglish: correctEnglish.trim(),
        audioUrl: audioPublicUrl,
      });

      // Reset
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
                <audio controls src={audioUrl} className="w-full h-10" />
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
