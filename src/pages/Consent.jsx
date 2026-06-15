import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthCard from "../Components/AuthCard";
import { CONSENT_TEXT } from "../data/consentText";
import { useUser } from "../context/UserContext";
import { subscribeToPush } from "../hooks/usePushNotifications";
import { signupUser } from "../utils/userApi";
import {
  clearSignupDraft,
  draftToSignupPayload,
  loadSignupDraft,
} from "../utils/signupDraft";

export default function Consent() {
  const navigate = useNavigate();
  const { setUser } = useUser();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    const savedDraft = loadSignupDraft();
    if (!savedDraft) {
      navigate("/signup", { replace: true });
      return;
    }
    setDraft(savedDraft);
  }, [navigate]);

  const submit = async (event) => {
    event.preventDefault();
    if (!agreed || !draft || submitting) return;

    setError("");
    setSubmitting(true);

    try {
      const user = await signupUser(draftToSignupPayload(draft));
      clearSignupDraft();
      setUser(user);

      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        await subscribeToPush(user);
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to complete signup.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!draft) {
    return null;
  }

  return (
    <AuthCard
      title="Consent Form"
      subtitle="Please read carefully before you continue"
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="max-h-64 overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900/80 p-4 text-sm leading-relaxed text-gray-300 whitespace-pre-line">
          {CONSENT_TEXT}
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-neutral-600 bg-neutral-900 text-yellow-400 focus:ring-yellow-400"
          />
          <span className="text-sm text-gray-300">
            I have read and agree to the above
          </span>
        </label>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={!agreed || submitting}
          className="w-full rounded-lg bg-yellow-400 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating account…" : "Submit & Continue"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-400">
        Need to edit your details?{" "}
        <Link to="/signup" className="text-yellow-400 hover:text-yellow-300 underline">
          Back to signup
        </Link>
      </p>
    </AuthCard>
  );
}
