// src/hooks/useRecorder.js
import { useEffect, useState, useRef } from "react";

export function useRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const stopPromiseRef = useRef(null);
  const chunksRef = useRef([]);
  const mimeTypeRef = useRef(null); // 👈 store selected format

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    // ✅ iOS-first format selection
    let mimeType = "";

    if (window.MediaRecorder) {
      if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4"; // ✅ iOS best
      } else if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus"; // ✅ Android best
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      }
    }

    mimeTypeRef.current = mimeType;

    const mediaRecorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      // Speech does not need the browser's often very high default bitrate.
      // This also keeps five-minute recordings practical on mobile networks.
      audioBitsPerSecond: 48000,
    });
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    // Periodic chunks are more reliable than one long in-memory chunk on mobile.
    mediaRecorder.start(1000);
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (stopPromiseRef.current) return stopPromiseRef.current;

    const mediaRecorder = mediaRecorderRef.current;

    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsRecording(false);
      return Promise.resolve(
        new Blob(chunksRef.current, { type: mimeTypeRef.current || "audio/webm" })
      );
    }

    stopPromiseRef.current = new Promise((resolve, reject) => {

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeTypeRef.current || "audio/webm",
        });

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setIsRecording(false);
        stopPromiseRef.current = null;
        resolve(blob);
      };

      mediaRecorder.onerror = (event) => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setIsRecording(false);
        stopPromiseRef.current = null;
        reject(event.error || new Error("Recording failed."));
      };

      try {
        mediaRecorder.stop();
      } catch (error) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setIsRecording(false);
        stopPromiseRef.current = null;
        reject(error);
      }
    });

    return stopPromiseRef.current;
  };

  const resetRecording = () => {
    chunksRef.current = [];
  };

  useEffect(() => () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder?.state === "recording") {
      mediaRecorder.onstop = null;
      mediaRecorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    resetRecording,
  };
}
