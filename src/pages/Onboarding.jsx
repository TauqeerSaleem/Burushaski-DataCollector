//ONBOARDING.JSX
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { subscribeToPush } from "../hooks/usePushNotifications";
import { USER_ROLES, DEFAULT_USER_ROLE } from "../utils/roles";

export default function Onboarding() {
  const [participantId, setParticipantId] = useState("");
  const [idError, setIdError] = useState("");
  const [role, setRole] = useState(DEFAULT_USER_ROLE);

  const { setUser } = useUser();
  const navigate = useNavigate();

  const validateParticipantId = (id) => /^P-\d+$/.test(id);

  const handleIdChange = (e) => {
    const value = e.target.value.toUpperCase();
    setParticipantId(value);

    if (value && !validateParticipantId(value)) {
      setIdError("Format must be P-XXX (e.g., P-001, P-123)");
    } else {
      setIdError("");
    }
  };

  const handleLogin = async () => {
    if (!participantId) return;

    if (!validateParticipantId(participantId)) {
      setIdError("Invalid format. Use P-XXX (e.g., P-001)");
      return;
    }

    const userData = { participantId, username: participantId, role };

    if (Notification.permission === "granted") {
      await subscribeToPush(userData);
    }

    setUser(userData);
    navigate("/instructions", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-950 p-6 shadow-2xl border border-neutral-800 space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-yellow-400">
            Welcome
          </h1>
          <p className="text-sm text-gray-400">
            Help us record Burushaski sentences
          </p>
        </div>

        {/* Login */}
        <div className="space-y-3">
          <input
            className={`w-full bg-transparent border-0 border-b px-1 py-2 text-sm text-white placeholder-gray-500 focus:outline-none ${
              idError ? "border-red-500" : "border-neutral-600 focus:border-yellow-400"
            }`}
            placeholder="Enter your ID (e.g. P-023)"
            value={participantId}
            onChange={handleIdChange}
          />
          {idError && <p className="text-xs text-red-400">{idError}</p>}
          {!idError && participantId && validateParticipantId(participantId) && (
            <p className="text-xs text-green-400">✓ Valid format</p>
          )}

          {/* Role */}
          <select
            className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value={USER_ROLES.VOLUNTEER}>Volunteer</option>
            <option value={USER_ROLES.CONTENT_CONTRIBUTOR}>Content Contributor</option>
            <option value={USER_ROLES.RESEARCHER}>Researcher</option>
            <option value={USER_ROLES.ADMIN}>Admin</option>
          </select>

          <button
            onClick={handleLogin}
            disabled={!participantId || !validateParticipantId(participantId)}
            className="w-full rounded-lg bg-yellow-400 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Log In
          </button>
        </div>

        {/* Sign Up */}
        <button
          onClick={() => navigate("/signup")}
          className="w-full rounded-lg bg-neutral-900 border border-neutral-700 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          New User? Sign Up
        </button>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500">
          Your data is anonymous and used only for research.
        </p>
      </div>
    </div>
  );
}