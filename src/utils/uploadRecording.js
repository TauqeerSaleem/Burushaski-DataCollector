import { supabase } from "./supabase";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:3001" : "");

const MAX_ATTEMPTS = 3;
const API_TIMEOUT_MS = 20000;
const STORAGE_UPLOAD_TIMEOUT_MS = 120000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function encodedHeader(value) {
  return encodeURIComponent(value == null ? "" : String(value));
}

async function apiJson(path, options, attempts = MAX_ATTEMPTS) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        signal: controller.signal,
      });
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
      lastError = error.name === "AbortError" ? new Error("The upload server took too long to respond.") : error;
    } finally {
      window.clearTimeout(timeoutId);
    }

    if (attempt < attempts) await wait(500 * 2 ** (attempt - 1));
  }

  throw lastError || new Error("The server could not be reached.");
}

async function uploadViaBackend(metadata, blob) {
  const response = await withTimeout(
    fetch(`${API_BASE_URL}/api/recordings`, {
      method: "POST",
      headers: {
        "Content-Type": metadata.contentType,
        "X-Participant-Id": metadata.participantId,
        "X-Module-Id": metadata.moduleId,
        "X-Sentence-Id": metadata.sentenceId,
        "X-Transcript": encodedHeader(metadata.transcript),
        "X-English-Translation": encodedHeader(metadata.englishTranslation),
        "X-Correction-Flag": metadata.correctionFlag ? "true" : "false",
        "X-Suggested-Correction": encodedHeader(metadata.suggestedCorrection),
        "X-Recording-Duration-Ms": String(metadata.durationMs || 0),
      },
      body: blob,
    }),
    STORAGE_UPLOAD_TIMEOUT_MS,
    "Live upload took too long. The recording can be saved on this device and retried."
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || `Live upload failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }

  return data.recording;
}

async function uploadViaSignedStorage(metadata, blob) {
  const intent = await apiJson("/api/recordings/upload-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });

  const complete = () => apiJson("/api/recordings/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...metadata, path: intent.path }),
  });

  if (intent.alreadyUploaded) {
    const data = await complete();
    return data.recording;
  }

  const { error: storageError } = await withTimeout(
    supabase.storage
      .from("audio-recordings")
      .uploadToSignedUrl(intent.path, intent.token, blob, {
        contentType: intent.contentType,
      }),
    STORAGE_UPLOAD_TIMEOUT_MS,
    "Audio upload took too long. It is saved on this device and will retry."
  );

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

  try {
    return await uploadViaBackend(metadata, blob);
  } catch (error) {
    if (error.status && error.status < 500 && error.status !== 408 && error.status !== 409) {
      throw error;
    }
    return uploadViaSignedStorage(metadata, blob);
  }
}
