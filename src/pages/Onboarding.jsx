//ONBOARDING.JSX
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { subscribeToPush } from "../hooks/usePushNotifications";
import { loginUser, signupUser } from "../utils/userApi";

export default function Onboarding() {
  const [mode, setMode] = useState("login"); // "login" | "signup"

  // login fields
  const [username, setUsername] = useState("");

  // signup fields
  const [signupUsername, setSignupUsername] = useState("");
  const [name, setName] = useState("");
  const [dialect, setDialect] = useState("");
  const [gender, setGender] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { setUser } = useUser();
  const navigate = useNavigate();

  function switchMode(next) {
    setMode(next);
    setError("");
  }

  const handleLogin = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setError("");
    try {
      const userData = await loginUser(username.trim());
      if (Notification.permission === "granted") {
        await subscribeToPush(userData);
      }
      setUser(userData);
      navigate("/instructions", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed. Check your username and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!signupUsername.trim() || !dialect || !gender) return;
    setLoading(true);
    setError("");
    try {
      const userData = await signupUser({
        username: signupUsername.trim(),
        name: name.trim() || undefined,
        dialect,
        gender,
        consentAccepted: true,
      });
      if (Notification.permission === "granted") {
        await subscribeToPush(userData);
      }
      setUser(userData);
      navigate("/instructions", { replace: true });
    } catch (err) {
      setError(err.message || "Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-gradient-to-b from-neutral-900 to-neutral-950 p-6 shadow-2xl border border-neutral-800 space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-yellow-400">
            {mode === "login" ? "Welcome back" : "Create account"}
          </h1>
          <p className="text-sm text-gray-400">
            Help us record Burushaski sentences
          </p>
        </div>

        {/* Form */}
        {mode === "login" ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Username</label>
              <input
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="e.g. sara_hunza"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                autoComplete="username"
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              onClick={handleLogin}
              disabled={!username.trim() || loading}
              className="w-full rounded-lg bg-yellow-400 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in…" : "Continue"}
            </button>

            <p className="text-center text-xs text-gray-500">
              Don't have an account?{" "}
              <button
                onClick={() => switchMode("signup")}
                className="text-yellow-400 hover:underline"
              >
                Sign up
              </button>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Username</label>
              <input
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="e.g. sara_hunza"
                value={signupUsername}
                onChange={(e) => setSignupUsername(e.target.value)}
                autoComplete="username"
              />
              <p className="text-xs text-gray-500">3–32 chars, letters, numbers, . _ -</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">Display name <span className="text-gray-600">(optional)</span></label>
              <input
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="e.g. Sara"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">Dialect</label>
              <select
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                value={dialect}
                onChange={(e) => setDialect(e.target.value)}
              >
                <option value="">Select dialect</option>
                <option value="yasin">Yasin</option>
                <option value="hunza">Hunza</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">Gender</label>
              <select
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="">Select gender</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              onClick={handleSignup}
              disabled={!signupUsername.trim() || !dialect || !gender || loading}
              className="w-full rounded-lg bg-yellow-400 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account…" : "Sign up"}
            </button>

            <p className="text-center text-xs text-gray-500">
              Already have an account?{" "}
              <button
                onClick={() => switchMode("login")}
                className="text-yellow-400 hover:underline"
              >
                Log in
              </button>
            </p>
          </div>
        )}

        <p className="text-center text-xs text-gray-500">
          Your data is anonymous and used only for research.
        </p>
      </div>
    </div>
  );
}
