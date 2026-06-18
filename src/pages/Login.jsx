import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import AuthCard from "../Components/AuthCard";
import { useUser } from "../context/UserContext";
import { subscribeToPush } from "../hooks/usePushNotifications";
import { loginUser } from "../utils/userApi";

export default function Login() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user, setUser } = useUser();
  const navigate = useNavigate();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const submit = async (event) => {
    event.preventDefault();

    const trimmedUsername = username.trim();
    if (!trimmedUsername) return;

    setError("");
    setSubmitting(true);

    try {
      const user = await loginUser(trimmedUsername);
      setUser(user);

      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        await subscribeToPush(user);
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to log in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Welcome Back"
      subtitle="Log in with your username to continue recording"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="username" className="text-xs text-gray-400">
            Username
          </label>
          <input
            id="username"
            className="input-field"
            placeholder="Your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={!username.trim() || submitting}
          className="w-full rounded-lg bg-yellow-400 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Logging in…" : "Log In"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-400">
        New volunteer?{" "}
        <Link to="/signup" className="text-yellow-400 hover:text-yellow-300 underline">
          Sign up
        </Link>
      </p>

      <p className="text-center text-xs text-gray-500">
        Admin access?{" "}
        <Link to="/admin/login" className="text-yellow-400 hover:text-yellow-300 underline">
          Log in here
        </Link>
      </p>
    </AuthCard>
  );
}
