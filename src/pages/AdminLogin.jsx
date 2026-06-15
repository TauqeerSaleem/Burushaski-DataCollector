import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AuthCard from "../Components/AuthCard";
import { adminLogin, getAdminToken } from "../utils/adminApi";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  if (getAdminToken()) {
    return <Navigate to="/admin" replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await adminLogin({ username, password });
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to log in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Admin Login"
      subtitle="Protected access for project administrators"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="admin-username" className="text-xs text-gray-400">
            Admin username
          </label>
          <input
            id="admin-username"
            className="input-field"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="admin-password" className="text-xs text-gray-400">
            Password
          </label>
          <input
            id="admin-password"
            className="input-field"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={!username.trim() || !password.trim() || submitting}
          className="w-full rounded-lg bg-yellow-400 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Logging in..." : "Log In"}
        </button>
      </form>
    </AuthCard>
  );
}
