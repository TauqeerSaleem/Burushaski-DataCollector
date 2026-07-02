import { supabase } from "./supabase";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:3001" : "");

const MAX_ATTEMPTS = 3;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiJson(path, options, attempts = MAX_ATTEMPTS) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, options);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || `Request failed (${response.status}).`);
        error.status = response.status;
        // Validation/conflict errors will not improve with a retry.
        if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
          throw error;
        }
        lastError = error;
      } else {
        return data;
      }
    } catch (error) {
      if (error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) throw error;
      lastError = error;
    }

    if (attempt < attempts) await wait(500 * 2 ** (attempt - 1));
  }

  throw lastError || new Error("The server could not be reached.");
}

export async function uploadRecording({
  blob,
  participantId,
  dialect,
  gender,
  moduleId,
  sentenceId,
  transcript,
  englishTranslation,
  correctionFlag,
  suggestedCorrection,
  promptType,
  durationMs,
}) {
  const metadata = {
    participantId,
    dialect,
    gender,
    moduleId,
    sentenceId,
    transcript,
    englishTranslation,
    correctionFlag,
    suggestedCorrection,
    promptType,
    durationMs,
    contentType: blob.type || "audio/webm",
    fileSize: blob.size,
  };

  const intent = await apiJson("/api/recordings/upload-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });

  const { error: storageError } = await supabase.storage
    .from("audio-recordings")
    .uploadToSignedUrl(intent.path, intent.token, blob, {
      contentType: intent.contentType,
    });

  const complete = () => apiJson("/api/recordings/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...metadata, path: intent.path }),
  });

  if (storageError) {
    // A mobile connection can drop after Storage accepted the bytes but before
    // the browser received the response. Completion safely checks the object.
    try {
      const recovered = await complete();
      return recovered.recording;
    } catch {
      throw new Error(`Audio upload failed: ${storageError.message || "check your connection and try again."}`);
    }
  }

  const data = await complete();
  return data.recording;
}
