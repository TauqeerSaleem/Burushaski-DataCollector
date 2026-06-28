import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import Dashboard from "./Dashboard";
import { createContribution, getUserContributions } from "../utils/userApi";
import { getRoleLabel, normalizeUserRole, USER_ROLES } from "../utils/roles";

const contentTypes = ["Audio Link", "Video Link"];
const researcherTypes = ["Interview", "Focus Group", "Monologue", "Conversation"];

const initialContentForm = {
  contentType: contentTypes[0],
  mediaUrl: "",
  description: "",
  languageNotes: "",
};

const initialResearcherForm = {
  contentType: researcherTypes[0],
  mediaUrl: "",
  speakerMetadata: "",
  turnTakingNotes: "",
  languageNotes: "",
};

function FieldLabel({ children }) {
  return <span className="text-sm font-semibold text-neutral-200">{children}</span>;
}

function StatusBadge({ status }) {
  const reviewed = status === "reviewed";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        reviewed
          ? "bg-emerald-400/15 text-emerald-300"
          : "bg-yellow-400/15 text-yellow-300"
      }`}
    >
      {status || "pending"}
    </span>
  );
}

function SubmissionList({ contributions, loading }) {
  if (loading) {
    return <p className="text-sm text-neutral-400">Loading submissions...</p>;
  }

  if (!contributions.length) {
    return (
      <p className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-400">
        No submissions yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {contributions.map((contribution) => (
        <div
          key={contribution.id}
          className="rounded-lg border border-neutral-800 bg-neutral-950 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">{contribution.contentType}</h3>
              <p className="mt-1 break-all text-sm text-neutral-400">
                {contribution.mediaUrl}
              </p>
            </div>
            <StatusBadge status={contribution.status} />
          </div>
          {contribution.description && (
            <p className="mt-3 text-sm text-neutral-300">{contribution.description}</p>
          )}
          <p className="mt-3 text-xs text-neutral-500">
            Submitted{" "}
            {contribution.createdAt
              ? new Date(contribution.createdAt).toLocaleString()
              : "recently"}
          </p>
        </div>
      ))}
    </div>
  );
}

function DashboardShell({ role, title, description, children }) {
  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-yellow-400">{getRoleLabel(role)}</p>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-neutral-300">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function useContributions(username) {
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadContributions() {
      try {
        setLoading(true);
        setError("");
        const data = await getUserContributions(username);
        if (active) setContributions(data);
      } catch (err) {
        if (active) setError(err.message || "Unable to load submissions.");
      } finally {
        if (active) setLoading(false);
      }
    }

    if (username) {
      loadContributions();
    }

    return () => {
      active = false;
    };
  }, [username]);

  return { contributions, setContributions, loading, error, setError };
}

function ContentContributorDashboard({ user, role }) {
  const [form, setForm] = useState(initialContentForm);
  const [showVolunteerTasks, setShowVolunteerTasks] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const { contributions, setContributions, loading, error, setError } =
    useContributions(user.username);

  if (showVolunteerTasks) {
    return <Dashboard />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const contribution = await createContribution({
        username: user.username,
        role,
        contentType: form.contentType,
        mediaUrl: form.mediaUrl,
        description: form.description,
        languageNotes: form.languageNotes,
      });
      setContributions((current) => [contribution, ...current]);
      setForm(initialContentForm);
      setMessage("Submission received.");
    } catch (err) {
      setError(err.message || "Unable to submit contribution.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell
      role={role}
      title="Content Contributor Dashboard"
      description="Share existing Burushaski audio or video content and add language notes when available."
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
      >
        <label className="block space-y-2">
          <FieldLabel>Content type</FieldLabel>
          <select
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-white focus:border-yellow-400 focus:outline-none"
            value={form.contentType}
            onChange={(event) => setForm({ ...form, contentType: event.target.value })}
          >
            {contentTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <FieldLabel>Media URL</FieldLabel>
          <input
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-white placeholder:text-neutral-600 focus:border-yellow-400 focus:outline-none"
            type="url"
            required
            value={form.mediaUrl}
            onChange={(event) => setForm({ ...form, mediaUrl: event.target.value })}
            placeholder="https://..."
          />
        </label>

        <label className="block space-y-2">
          <FieldLabel>Description</FieldLabel>
          <textarea
            className="min-h-28 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-white placeholder:text-neutral-600 focus:border-yellow-400 focus:outline-none"
            required
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="What is this content about?"
          />
        </label>

        <details className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-yellow-400">
            Want to help with transcript/translation? (optional)
          </summary>
          <textarea
            className="mt-4 min-h-28 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-white placeholder:text-neutral-600 focus:border-yellow-400 focus:outline-none"
            value={form.languageNotes}
            onChange={(event) => setForm({ ...form, languageNotes: event.target.value })}
            placeholder="[00:12] Speaker: transcript or translation notes..."
          />
        </details>

        {error && <p className="text-sm text-red-300">{error}</p>}
        {message && <p className="text-sm text-emerald-300">{message}</p>}

        <button
          className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Submitting..." : "Submit contribution"}
        </button>
      </form>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-lg font-semibold text-yellow-400">Your Submissions</h2>
        <div className="mt-4">
          <SubmissionList contributions={contributions} loading={loading} />
        </div>
      </div>

      <p className="text-sm text-neutral-400">
        You can also contribute through{" "}
        <button
          className="font-semibold text-yellow-400 hover:text-yellow-300"
          type="button"
          onClick={() => setShowVolunteerTasks(true)}
        >
          Volunteer tasks
        </button>{" "}
        using the same account.
      </p>
    </DashboardShell>
  );
}

function ResearcherDashboard({ user, role }) {
  const [form, setForm] = useState(initialResearcherForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const { contributions, setContributions, loading, error, setError } =
    useContributions(user.username);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const contribution = await createContribution({
        username: user.username,
        role,
        contentType: form.contentType,
        mediaUrl: form.mediaUrl,
        speakerMetadata: form.speakerMetadata,
        turnTakingNotes: form.turnTakingNotes,
        languageNotes: form.languageNotes,
      });
      setContributions((current) => [contribution, ...current]);
      setForm(initialResearcherForm);
      setMessage("Research submission received.");
    } catch (err) {
      setError(err.message || "Unable to submit contribution.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell
      role={role}
      title="Researcher Dashboard"
      description="Submit supervised long-form recordings with speaker metadata, turn-taking notes, transcripts, and translations."
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
      >
        <label className="block space-y-2">
          <FieldLabel>Content type</FieldLabel>
          <select
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-white focus:border-yellow-400 focus:outline-none"
            value={form.contentType}
            onChange={(event) => setForm({ ...form, contentType: event.target.value })}
          >
            {researcherTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <FieldLabel>Media URL</FieldLabel>
          <input
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-white placeholder:text-neutral-600 focus:border-yellow-400 focus:outline-none"
            type="url"
            required
            value={form.mediaUrl}
            onChange={(event) => setForm({ ...form, mediaUrl: event.target.value })}
            placeholder="https://..."
          />
        </label>

        <label className="block space-y-2">
          <FieldLabel>Speaker metadata</FieldLabel>
          <textarea
            className="min-h-32 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-white placeholder:text-neutral-600 focus:border-yellow-400 focus:outline-none"
            required
            value={form.speakerMetadata}
            onChange={(event) => setForm({ ...form, speakerMetadata: event.target.value })}
            placeholder="Speaker A: dialect, sub-dialect, gender, age range..."
          />
        </label>

        <label className="block space-y-2">
          <FieldLabel>Turn-taking and speaker identity notes</FieldLabel>
          <textarea
            className="min-h-28 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-white placeholder:text-neutral-600 focus:border-yellow-400 focus:outline-none"
            value={form.turnTakingNotes}
            onChange={(event) => setForm({ ...form, turnTakingNotes: event.target.value })}
            placeholder="Speaker labels, overlaps, topic shifts, uncertain identities..."
          />
        </label>

        <label className="block space-y-2">
          <FieldLabel>Timestamped transcript/translation</FieldLabel>
          <textarea
            className="min-h-36 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-white placeholder:text-neutral-600 focus:border-yellow-400 focus:outline-none"
            value={form.languageNotes}
            onChange={(event) => setForm({ ...form, languageNotes: event.target.value })}
            placeholder="[00:12] Speaker A: ..."
          />
        </label>

        {error && <p className="text-sm text-red-300">{error}</p>}
        {message && <p className="text-sm text-emerald-300">{message}</p>}

        <button
          className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Submitting..." : "Submit research contribution"}
        </button>
      </form>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h2 className="text-lg font-semibold text-yellow-400">Your Submissions</h2>
        <div className="mt-4">
          <SubmissionList contributions={contributions} loading={loading} />
        </div>
      </div>
    </DashboardShell>
  );
}

function AdminDashboard({ role }) {
  return (
    <DashboardShell
      role={role}
      title="Admin Dashboard"
      description="Administrative monitoring tools are protected behind the admin login."
    >
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <a
          href="/admin"
          className="inline-flex rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300"
        >
          Open admin panel
        </a>
      </div>
    </DashboardShell>
  );
}

export default function RoleDashboard() {
  const { user } = useUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = normalizeUserRole(user.role);

  if (role === USER_ROLES.VOLUNTEER) {
    return <Dashboard />;
  }

  if (role === USER_ROLES.CONTENT_CONTRIBUTOR) {
    return <ContentContributorDashboard user={user} role={role} />;
  }

  if (role === USER_ROLES.RESEARCHER) {
    return <ResearcherDashboard user={user} role={role} />;
  }

  return <AdminDashboard role={role} />;
}
