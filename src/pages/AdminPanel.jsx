import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  clearAdminSession,
  createAdminAccount,
  createPrompt,
  createResearchTask,
  deactivatePrompt,
  deleteAdminAccount,
  deleteAdminUser,
  exportAdminData,
  fetchAdminData,
  fetchAdminOverview,
  fetchAdminPrompts,
  fetchAdminRecords,
  fetchAdmins,
  fetchAdminSession,
  fetchAdminUsers,
  fetchResearchTasks,
  getAdminToken,
  getSavedAdmin,
  updateAdminAccount,
  updateAdminUser,
  updatePrompt,
  updateResearchTask,
  uploadPromptMedia,
} from "../utils/adminApi";
import { getRoleLabel, USER_ROLES } from "../utils/roles";

const tabs = [
  { id: "overview", label: "Dashboard" },
  { id: "prompts", label: "Volunteer Prompts" },
  { id: "research", label: "Research Tasks" },
  { id: "users", label: "Participants" },
  { id: "data", label: "Records" },
  { id: "admins", label: "Admin Accounts" },
];

const emptyPrompt = {
  promptId: "",
  moduleId: "admin-prompts",
  moduleTitle: "Admin Prompts",
  promptType: "elicitation",
  dialect: "",
  english: "",
  transliteration: "",
  mediaUrl: "",
  mediaType: "none",
  difficulty: "short",
  curriculumStage: "",
  grammaticalCategory: "",
  weight: 1,
  sortOrder: 0,
  active: true,
};

const emptyTask = {
  title: "",
  taskType: "transcription",
  assignedTo: "",
  sourceType: "audio",
  sourceRef: "",
  sourceText: "",
  instructions: "",
  status: "todo",
  priority: "normal",
  dueDate: "",
  transcript: "",
  translation: "",
  notes: "",
};

const editableUserFields = [
  ["name", "Name"],
  ["role", "Role"],
  ["email", "Email"],
  ["dialect", "Dialect"],
  ["gender", "Gender"],
  ["age", "Age"],
  ["mobileNumber", "Mobile"],
  ["placeOfBirth", "Birthplace"],
  ["comfortLanguage", "Comfort language"],
  ["active", "Account status"],
];

const normalize = (value) => String(value || "").toLowerCase();

function uniq(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function matchesText(row, query, fields) {
  if (!query.trim()) return true;
  const needle = normalize(query);
  return fields.some((field) => normalize(row[field]).includes(needle));
}

function Badge({ tone = "neutral", children }) {
  const tones = {
    neutral: "border-neutral-700 bg-neutral-900 text-neutral-300",
    yellow: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
    green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
    red: "border-red-500/40 bg-red-500/10 text-red-300",
    blue: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  };

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

function PanelHeader({ eyebrow, title, detail }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-yellow-300">{eyebrow}</p>}
        <h2 className="mt-1 text-xl font-semibold text-white">{title}</h2>
      </div>
      {detail && <p className="text-sm text-neutral-400">{detail}</p>}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-yellow-400">{value}</p>
    </div>
  );
}

function Table({ columns, rows, emptyText = "No data yet." }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-800">
      <table className="min-w-full divide-y divide-neutral-800 text-sm">
        <thead className="bg-neutral-950 text-left text-xs uppercase text-neutral-400">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-3 font-semibold">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800 bg-neutral-900">
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-neutral-500" colSpan={columns.length}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={row.id || row.username || index}>
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-3 align-top text-neutral-200">
                    {column.render ? column.render(row) : row[column.key] || "-"}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function OverviewTab({ overview }) {
  const totals = overview?.totals || {};
  const roleRows = Object.entries(overview?.usersByRole || {}).map(([role, count]) => ({
    role: getRoleLabel(role),
    count,
  }));
  const dialectRows = Object.entries(overview?.usersByDialect || {}).map(([dialect, count]) => ({
    dialect,
    count,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Users" value={totals.users || 0} />
        <Stat label="Recordings" value={totals.recordings || 0} />
        <Stat label="Feedback" value={totals.feedback || 0} />
        <Stat label="Push subs" value={totals.pushSubscriptions || 0} />
        <Stat label="Notifications" value={totals.notificationLogs || 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Table columns={[{ key: "role", label: "Role" }, { key: "count", label: "Users" }]} rows={roleRows} />
        <Table columns={[{ key: "dialect", label: "Dialect" }, { key: "count", label: "Users" }]} rows={dialectRows} />
      </div>
    </div>
  );
}

function PromptsTab({ prompts, onRefresh }) {
  const [form, setForm] = useState(emptyPrompt);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ search: "", dialect: "all", type: "all", status: "active" });
  const [error, setError] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const dialects = useMemo(() => uniq(prompts.map((prompt) => prompt.dialect || "all dialects")), [prompts]);
  const filteredPrompts = useMemo(
    () =>
      prompts.filter((prompt) => {
        const dialect = prompt.dialect || "all dialects";
        const status = prompt.active ? "active" : "inactive";
        return (
          matchesText(prompt, filters.search, ["promptId", "moduleTitle", "english", "transliteration", "grammaticalCategory"]) &&
          (filters.dialect === "all" || dialect === filters.dialect) &&
          (filters.type === "all" || prompt.promptType === filters.type) &&
          (filters.status === "all" || status === filters.status)
        );
      }),
    [filters, prompts]
  );

  const promptStats = useMemo(
    () => ({
      active: prompts.filter((prompt) => prompt.active).length,
      image: prompts.filter((prompt) => prompt.mediaType === "image" || prompt.promptType === "picture_description").length,
      dialects: uniq(prompts.map((prompt) => prompt.dialect)).length,
    }),
    [prompts]
  );

  const save = async (event) => {
    event.preventDefault();
    setError("");

    try {
      if (editingId) {
        await updatePrompt(editingId, form);
      } else {
        await createPrompt(form);
      }

      setForm(emptyPrompt);
      setEditingId(null);
      await onRefresh();
    } catch (err) {
      setError(err.message || "Unable to save prompt.");
    }
  };

  const edit = (prompt) => {
    setEditingId(prompt.id);
    setForm({ ...emptyPrompt, ...prompt });
    setError("");
  };

  const deactivate = async (prompt) => {
    if (!window.confirm(`Deactivate prompt ${prompt.promptId}?`)) return;

    try {
      await deactivatePrompt(prompt.id);
      await onRefresh();
    } catch (err) {
      setError(err.message || "Unable to deactivate prompt.");
    }
  };

  const uploadMedia = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setUploadingMedia(true);
    try {
      const publicUrl = await uploadPromptMedia(file);
      setForm({ ...form, mediaType: "image", mediaUrl: publicUrl });
    } catch (err) {
      setError(err.message || "Unable to upload image.");
    } finally {
      setUploadingMedia(false);
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <PanelHeader
        eyebrow="Volunteer collection"
        title="Prompt bank"
        detail={`${promptStats.active} active prompts · ${promptStats.image} image prompts · ${promptStats.dialects || 0} dialects`}
      />

      {error && <p className="rounded bg-red-950 px-3 py-2 text-sm text-red-200">{error}</p>}

      <form autoComplete="off" onSubmit={save} className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">{editingId ? "Edit prompt" : "Add prompt"}</h3>
            <p className="text-xs text-neutral-500">These are the exact prompts volunteers can receive on the recording screen.</p>
          </div>
          <Badge tone={form.active ? "green" : "neutral"}>{form.active ? "Active" : "Draft"}</Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-12">
          <input className="input-field md:col-span-2" name="prompt-id" autoComplete="off" placeholder="Prompt ID" value={form.promptId} onChange={(event) => setForm({ ...form, promptId: event.target.value })} />
          <input className="input-field md:col-span-2" name="module-id" autoComplete="off" placeholder="Module ID" value={form.moduleId} onChange={(event) => setForm({ ...form, moduleId: event.target.value })} />
          <input className="input-field md:col-span-3" name="module-title" autoComplete="off" placeholder="Module title" value={form.moduleTitle} onChange={(event) => setForm({ ...form, moduleTitle: event.target.value })} />
          <select className="select-field md:col-span-2" value={form.promptType} onChange={(event) => setForm({ ...form, promptType: event.target.value, mediaType: event.target.value === "picture_description" ? "image" : form.mediaType })}>
            <option value="translation">Translate / repeat</option>
            <option value="elicitation">Speak aloud</option>
            <option value="picture_description">Describe image</option>
            <option value="validation">Validation</option>
            <option value="gamified">Gamified prompt</option>
          </select>
          <select className="select-field md:col-span-3" value={form.active ? "true" : "false"} onChange={(event) => setForm({ ...form, active: event.target.value === "true" })}>
            <option value="true">Active for volunteers</option>
            <option value="false">Draft / hidden</option>
          </select>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <textarea className="input-field min-h-24" name="english-prompt" autoComplete="off" placeholder="Volunteer-facing instruction or English sentence" value={form.english} onChange={(event) => setForm({ ...form, english: event.target.value })} />
          <textarea className="input-field min-h-24" name="transliteration" autoComplete="off" placeholder="Burushaski text, transliteration, or helper line" value={form.transliteration} onChange={(event) => setForm({ ...form, transliteration: event.target.value })} />
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <input className="input-field" name="dialect" autoComplete="off" placeholder="Dialect or blank for all" value={form.dialect} onChange={(event) => setForm({ ...form, dialect: event.target.value })} />
          <select className="select-field" value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}>
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select>
          <input className="input-field" name="category" autoComplete="off" placeholder="Grammar/category" value={form.grammaticalCategory} onChange={(event) => setForm({ ...form, grammaticalCategory: event.target.value })} />
          <input className="input-field" name="weight" type="number" min="0" placeholder="Weight" value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })} />
          <input className="input-field" name="sort-order" type="number" placeholder="Sort order" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <select className="select-field" value={form.mediaType} onChange={(event) => setForm({ ...form, mediaType: event.target.value })}>
            <option value="none">No media</option>
            <option value="image">Image prompt</option>
            <option value="audio">Audio reference</option>
          </select>
          {(form.mediaType !== "none" || form.promptType === "picture_description") && (
            <input className="input-field" name="media-url" autoComplete="off" placeholder="Paste image/audio URL, or upload below" value={form.mediaUrl} onChange={(event) => setForm({ ...form, mediaUrl: event.target.value })} />
          )}
          <input className="input-field" name="curriculum-stage" autoComplete="off" placeholder="Curriculum stage" value={form.curriculumStage} onChange={(event) => setForm({ ...form, curriculumStage: event.target.value })} />
        </div>

        {(form.mediaType === "image" || form.promptType === "picture_description") && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-neutral-800 bg-neutral-950/60 p-3">
            <label className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700">
              {uploadingMedia ? "Uploading..." : "Upload local image"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                disabled={uploadingMedia}
                onChange={uploadMedia}
              />
            </label>
            {form.mediaUrl && (
              <a className="text-sm text-yellow-300 underline" href={form.mediaUrl} target="_blank" rel="noreferrer">
                Open current media
              </a>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button className="rounded bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300" disabled={!form.promptId || !form.english}>
            {editingId ? "Save Prompt" : "Add Prompt"}
          </button>
          {editingId && (
            <button type="button" className="rounded bg-neutral-800 px-4 py-2 text-sm text-white hover:bg-neutral-700" onClick={() => { setEditingId(null); setForm(emptyPrompt); }}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="grid gap-3 rounded-lg border border-neutral-800 bg-neutral-950/70 p-3 md:grid-cols-5">
        <input className="input-field md:col-span-2" placeholder="Search prompts, modules, text..." value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        <select className="select-field" value={filters.dialect} onChange={(event) => setFilters({ ...filters, dialect: event.target.value })}>
          <option value="all">All dialects</option>
          {dialects.map((dialect) => (
            <option key={dialect} value={dialect}>{dialect}</option>
          ))}
        </select>
        <select className="select-field" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
          <option value="all">All types</option>
          <option value="translation">Translate / repeat</option>
          <option value="elicitation">Speak aloud</option>
          <option value="picture_description">Describe image</option>
          <option value="validation">Validation</option>
          <option value="gamified">Gamified prompt</option>
        </select>
        <select className="select-field" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
          <option value="all">All statuses</option>
        </select>
      </div>

      <Table
        columns={[
          { key: "promptId", label: "Prompt", render: (prompt) => <span className="font-mono text-xs">{prompt.promptId}</span> },
          { key: "moduleTitle", label: "Module" },
          { key: "english", label: "Volunteer sees", render: (prompt) => <span className="block max-w-md text-neutral-300">{prompt.english}</span> },
          { key: "promptType", label: "Type", render: (prompt) => <Badge tone={prompt.promptType === "picture_description" ? "blue" : "neutral"}>{prompt.promptType}</Badge> },
          { key: "dialect", label: "Dialect", render: (prompt) => prompt.dialect || "all" },
          { key: "recordingCount", label: "Recordings" },
          { key: "active", label: "Status", render: (prompt) => <Badge tone={prompt.active ? "green" : "neutral"}>{prompt.active ? "Active" : "Inactive"}</Badge> },
          {
            key: "actions",
            label: "Actions",
            render: (prompt) => (
              <div className="flex gap-2">
                <button className="rounded bg-neutral-800 px-3 py-1 text-xs text-white hover:bg-neutral-700" onClick={() => edit(prompt)}>Edit</button>
                <button className="rounded bg-red-700 px-3 py-1 text-xs text-white hover:bg-red-600" onClick={() => deactivate(prompt)}>Deactivate</button>
              </div>
            ),
          },
        ]}
        rows={filteredPrompts}
        emptyText="No prompts match these filters."
      />
    </div>
  );
}

function ResearchTasksTab({ tasks, users, onRefresh }) {
  const researchers = users.filter((user) => user.role === USER_ROLES.RESEARCHER || user.role === USER_ROLES.ADMIN);
  const [form, setForm] = useState(emptyTask);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ search: "", assignedTo: "all", status: "all", type: "all" });
  const [error, setError] = useState("");

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const assignee = task.assignedTo || "unassigned";
        return (
          matchesText(task, filters.search, ["title", "taskType", "sourceRef", "sourceText", "instructions", "transcript", "translation", "notes"]) &&
          (filters.assignedTo === "all" || assignee === filters.assignedTo) &&
          (filters.status === "all" || task.status === filters.status) &&
          (filters.type === "all" || task.taskType === filters.type)
        );
      }),
    [filters, tasks]
  );

  const save = async (event) => {
    event.preventDefault();
    setError("");

    try {
      if (editingId) {
        await updateResearchTask(editingId, form);
      } else {
        await createResearchTask(form);
      }

      setForm(emptyTask);
      setEditingId(null);
      await onRefresh();
    } catch (err) {
      setError(err.message || "Unable to save research task.");
    }
  };

  const edit = (task) => {
    setEditingId(task.id);
    setForm({ ...emptyTask, ...task });
    setError("");
  };

  const assigneeName = (id) => users.find((user) => user.id === id)?.username || "-";

  return (
    <div className="space-y-6">
      <PanelHeader
        eyebrow="Research workflow"
        title="Assignments"
        detail={`${tasks.length} total · ${tasks.filter((task) => task.status !== "done").length} open`}
      />

      {error && <p className="rounded bg-red-950 px-3 py-2 text-sm text-red-200">{error}</p>}

      <form autoComplete="off" onSubmit={save} className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <input className="input-field" name="task-title" autoComplete="off" placeholder="Task title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <select className="select-field" value={form.taskType} onChange={(event) => setForm({ ...form, taskType: event.target.value })}>
            <option value="transcription">Transcription</option>
            <option value="translation">Translation</option>
            <option value="validation">Validation</option>
            <option value="metadata_review">Metadata review</option>
          </select>
          <select className="select-field" value={form.assignedTo} onChange={(event) => setForm({ ...form, assignedTo: event.target.value })}>
            <option value="">Unassigned</option>
            {researchers.map((user) => (
              <option key={user.id} value={user.id}>{user.username}</option>
            ))}
          </select>
          <select className="select-field" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <select className="select-field" value={form.sourceType} onChange={(event) => setForm({ ...form, sourceType: event.target.value })}>
            <option value="audio">Audio</option>
            <option value="text">Text</option>
            <option value="content_url">Content URL</option>
            <option value="recording">Recording row</option>
            <option value="feedback">Feedback row</option>
          </select>
          <input className="input-field" name="source-ref" autoComplete="off" placeholder="URL, storage path, or row ID" value={form.sourceRef} onChange={(event) => setForm({ ...form, sourceRef: event.target.value })} />
          <select className="select-field" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <input className="input-field" name="due-date" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <textarea className="input-field min-h-24" name="source-text" autoComplete="off" placeholder="Text to translate/transcribe, if applicable" value={form.sourceText} onChange={(event) => setForm({ ...form, sourceText: event.target.value })} />
          <textarea className="input-field min-h-24" name="instructions" autoComplete="off" placeholder="Instructions for researcher" value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} />
          <textarea className="input-field min-h-24" name="transcript" autoComplete="off" placeholder="Transcript" value={form.transcript} onChange={(event) => setForm({ ...form, transcript: event.target.value })} />
          <textarea className="input-field min-h-24" name="translation" autoComplete="off" placeholder="English translation" value={form.translation} onChange={(event) => setForm({ ...form, translation: event.target.value })} />
        </div>

        <textarea className="input-field min-h-20" name="notes" autoComplete="off" placeholder="Internal notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />

        <div className="flex flex-wrap gap-2">
          <button className="rounded bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300" disabled={!form.title}>
            {editingId ? "Save Task" : "Create Task"}
          </button>
          {editingId && (
            <button type="button" className="rounded bg-neutral-800 px-4 py-2 text-sm text-white hover:bg-neutral-700" onClick={() => { setEditingId(null); setForm(emptyTask); }}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="grid gap-3 rounded-lg border border-neutral-800 bg-neutral-950/70 p-3 md:grid-cols-5">
        <input className="input-field md:col-span-2" placeholder="Search assignments, source text, notes..." value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        <select className="select-field" value={filters.assignedTo} onChange={(event) => setFilters({ ...filters, assignedTo: event.target.value })}>
          <option value="all">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {researchers.map((user) => (
            <option key={user.id} value={user.id}>{user.username}</option>
          ))}
        </select>
        <select className="select-field" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
          <option value="all">All statuses</option>
          <option value="todo">To do</option>
          <option value="in_progress">In progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
          <option value="blocked">Blocked</option>
        </select>
        <select className="select-field" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
          <option value="all">All task types</option>
          <option value="transcription">Transcription</option>
          <option value="translation">Translation</option>
          <option value="validation">Validation</option>
          <option value="metadata_review">Metadata review</option>
        </select>
      </div>

      <Table
        columns={[
          { key: "title", label: "Task" },
          { key: "taskType", label: "Type" },
          { key: "assignedTo", label: "Assigned", render: (task) => assigneeName(task.assignedTo) },
          { key: "status", label: "Status", render: (task) => <Badge tone={task.status === "done" ? "green" : task.status === "blocked" ? "red" : "yellow"}>{task.status}</Badge> },
          { key: "priority", label: "Priority", render: (task) => <Badge tone={task.priority === "urgent" || task.priority === "high" ? "red" : "neutral"}>{task.priority}</Badge> },
          { key: "dueDate", label: "Due" },
          { key: "actions", label: "Actions", render: (task) => <button className="rounded bg-neutral-800 px-3 py-1 text-xs text-white hover:bg-neutral-700" onClick={() => edit(task)}>Edit</button> },
        ]}
        rows={filteredTasks}
        emptyText="No assignments match these filters."
      />
    </div>
  );
}

function UsersTab({ users, onRefresh }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [filters, setFilters] = useState({ search: "", role: "all", dialect: "all", status: "active" });
  const [error, setError] = useState("");

  const dialects = useMemo(() => uniq(users.map((user) => user.dialect)), [users]);
  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const status = user.active ? "active" : "inactive";
        return (
          matchesText(user, filters.search, ["username", "participantId", "name", "email", "mobileNumber", "placeOfBirth", "comfortLanguage"]) &&
          (filters.role === "all" || user.role === filters.role) &&
          (filters.dialect === "all" || user.dialect === filters.dialect) &&
          (filters.status === "all" || status === filters.status)
        );
      }),
    [filters, users]
  );

  const startEditing = (user) => {
    setEditingId(user.id);
    setDraft(user);
    setError("");
  };

  const save = async () => {
    setError("");

    try {
      await updateAdminUser(editingId, draft);
      setEditingId(null);
      await onRefresh();
    } catch (err) {
      setError(err.message || "Unable to update user.");
    }
  };

  const remove = async (user) => {
    if (!window.confirm(`Deactivate ${user.username}? Their research data stays in the database.`)) return;

    try {
      await deleteAdminUser(user.id);
      await onRefresh();
    } catch (err) {
      setError(err.message || "Unable to deactivate user.");
    }
  };

  return (
    <div className="space-y-4">
      <PanelHeader
        eyebrow="People"
        title="Participants and roles"
        detail={`${filteredUsers.length} shown · ${users.length} total`}
      />
      {error && <p className="rounded bg-red-950 px-3 py-2 text-sm text-red-200">{error}</p>}
      <div className="grid gap-3 rounded-lg border border-neutral-800 bg-neutral-950/70 p-3 md:grid-cols-5">
        <input className="input-field md:col-span-2" placeholder="Search username, ID, phone, place..." value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        <select className="select-field" value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value })}>
          <option value="all">All roles</option>
          {Object.values(USER_ROLES).map((role) => (
            <option key={role} value={role}>{getRoleLabel(role)}</option>
          ))}
        </select>
        <select className="select-field" value={filters.dialect} onChange={(event) => setFilters({ ...filters, dialect: event.target.value })}>
          <option value="all">All dialects</option>
          {dialects.map((dialect) => (
            <option key={dialect} value={dialect}>{dialect}</option>
          ))}
        </select>
        <select className="select-field" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
          <option value="all">All statuses</option>
        </select>
      </div>
      <div className="grid gap-4">
        {filteredUsers.map((user) => (
          <div key={user.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">{user.username}</p>
                <p className="text-sm text-neutral-400">
                  {user.participantId} · {getRoleLabel(user.role)} · {user.recordingCount || 0} recordings
                </p>
              </div>
              <Badge tone={user.active ? "green" : "neutral"}>{user.active ? "Active" : "Inactive"}</Badge>
              <div className="flex gap-2">
                <button className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700" onClick={() => startEditing(user)}>
                  Edit
                </button>
                <button className="rounded bg-red-700 px-3 py-2 text-sm text-white hover:bg-red-600" onClick={() => remove(user)}>
                  Deactivate
                </button>
              </div>
            </div>

            {editingId === user.id ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {editableUserFields.map(([key, label]) => (
                  <label key={key} className="space-y-1 text-xs text-neutral-400">
                    <span>{label}</span>
                    {key === "role" ? (
                      <select
                        className="select-field"
                        value={draft.role || USER_ROLES.VOLUNTEER}
                        onChange={(event) => setDraft({ ...draft, role: event.target.value })}
                      >
                        {Object.values(USER_ROLES).map((role) => (
                          <option key={role} value={role}>
                            {getRoleLabel(role)}
                          </option>
                        ))}
                      </select>
                    ) : key === "active" ? (
                      <select
                        className="select-field"
                        value={draft.active === false ? "false" : "true"}
                        onChange={(event) => setDraft({ ...draft, active: event.target.value === "true" })}
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    ) : (
                      <input
                        className="input-field"
                        value={draft[key] || ""}
                        onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                      />
                    )}
                  </label>
                ))}
                <div className="flex gap-2 md:col-span-2">
                  <button className="rounded bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300" onClick={save}>
                    Save
                  </button>
                  <button className="rounded bg-neutral-800 px-4 py-2 text-sm text-white hover:bg-neutral-700" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-2 text-sm text-neutral-300 md:grid-cols-4">
                <p>Dialect: {user.dialect || "-"}</p>
                <p>Gender: {user.gender || "-"}</p>
                <p>Age: {user.age || "-"}</p>
                <p>Contact: {user.email || user.mobileNumber || user.contactPreference || "-"}</p>
              </div>
            )}
          </div>
        ))}
        {filteredUsers.length === 0 && (
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-sm text-neutral-500">
            No participants match these filters.
          </div>
        )}
      </div>
    </div>
  );
}

function DataTab({ data, recordsPage, onRecordsPage, onExport }) {
  const [filters, setFilters] = useState({ search: "", moduleId: "all", participantId: "all" });
  const recordings = useMemo(() => recordsPage.rows || [], [recordsPage.rows]);
  const modules = useMemo(() => uniq(recordings.map((recording) => recording.moduleId)), [recordings]);
  const participants = useMemo(() => uniq(recordings.map((recording) => recording.participantId)), [recordings]);
  const filteredRecordings = useMemo(
    () =>
      recordings.filter((recording) =>
        matchesText(recording, filters.search, ["participantId", "moduleId", "sentenceId", "audioPath", "promptEnglish"]) &&
        (filters.moduleId === "all" || recording.moduleId === filters.moduleId) &&
        (filters.participantId === "all" || recording.participantId === filters.participantId)
      ),
    [filters, recordings]
  );

  return (
    <div className="space-y-6">
      <PanelHeader
        eyebrow="Collected data"
        title="Recordings and activity"
        detail={`${recordsPage.total || 0} total recordings · page ${recordsPage.page || 1} of ${recordsPage.totalPages || 1}`}
      />

      <div className="flex flex-wrap gap-2">
        <button className="rounded bg-yellow-400 px-3 py-2 text-sm font-semibold text-black hover:bg-yellow-300" onClick={() => onExport("recordings")}>
          Export recordings CSV
        </button>
        <button className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700" onClick={() => onExport("participants")}>
          Export participants CSV
        </button>
        <button className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700" onClick={() => onExport("prompts")}>
          Export prompts CSV
        </button>
      </div>

      <div className="grid gap-3 rounded-lg border border-neutral-800 bg-neutral-950/70 p-3 md:grid-cols-4">
        <input className="input-field md:col-span-2" placeholder="Search participant, module, prompt, audio path..." value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        <select className="select-field" value={filters.moduleId} onChange={(event) => setFilters({ ...filters, moduleId: event.target.value })}>
          <option value="all">All modules</option>
          {modules.map((moduleId) => (
            <option key={moduleId} value={moduleId}>{moduleId}</option>
          ))}
        </select>
        <select className="select-field" value={filters.participantId} onChange={(event) => setFilters({ ...filters, participantId: event.target.value })}>
          <option value="all">All participants</option>
          {participants.map((participantId) => (
            <option key={participantId} value={participantId}>{participantId}</option>
          ))}
        </select>
      </div>

      <Table
        columns={[
          { key: "participantId", label: "Participant" },
          { key: "moduleId", label: "Module" },
          { key: "sentenceId", label: "Prompt" },
          { key: "promptEnglish", label: "Prompt text", render: (recording) => <span className="block max-w-md">{recording.promptEnglish || "-"}</span> },
          { key: "audioPath", label: "Audio path", render: (recording) => <span className="font-mono text-xs">{recording.audioPath}</span> },
          { key: "createdAt", label: "Created" },
        ]}
        rows={filteredRecordings}
        emptyText="No recordings yet."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">
          Showing {filteredRecordings.length} rows on this page.
        </p>
        <div className="flex gap-2">
          <button
            className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-40"
            disabled={(recordsPage.page || 1) <= 1}
            onClick={() => onRecordsPage((recordsPage.page || 1) - 1)}
          >
            Previous
          </button>
          <button
            className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-40"
            disabled={(recordsPage.page || 1) >= (recordsPage.totalPages || 1)}
            onClick={() => onRecordsPage((recordsPage.page || 1) + 1)}
          >
            Next
          </button>
        </div>
      </div>
      <Table
        columns={[
          { key: "participant_id", label: "Participant" },
          { key: "correction", label: "Correction" },
          { key: "created_at", label: "Created" },
        ]}
        rows={data.feedback || []}
        emptyText="No feedback yet."
      />
      <Table
        columns={[
          { key: "admin_username", label: "Admin" },
          { key: "action", label: "Action" },
          { key: "target_type", label: "Target" },
          { key: "created_at", label: "Created" },
        ]}
        rows={data.activityLogs || []}
        emptyText="No admin activity yet."
      />
    </div>
  );
}

function AdminsTab({ admins, onRefresh }) {
  const [form, setForm] = useState({ username: "", displayName: "", password: "" });
  const [error, setError] = useState("");

  const create = async (event) => {
    event.preventDefault();
    setError("");

    try {
      await createAdminAccount(form);
      setForm({ username: "", displayName: "", password: "" });
      await onRefresh();
    } catch (err) {
      setError(err.message || "Unable to create admin.");
    }
  };

  const toggle = async (admin) => {
    try {
      await updateAdminAccount(admin.id, { active: !admin.active });
      await onRefresh();
    } catch (err) {
      setError(err.message || "Unable to update admin.");
    }
  };

  const remove = async (admin) => {
    if (!window.confirm(`Delete admin ${admin.username}?`)) return;

    try {
      await deleteAdminAccount(admin.id);
      await onRefresh();
    } catch (err) {
      setError(err.message || "Unable to delete admin.");
    }
  };

  return (
    <div className="space-y-6">
      {error && <p className="rounded bg-red-950 px-3 py-2 text-sm text-red-200">{error}</p>}
      <form autoComplete="off" onSubmit={create} className="grid gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4 md:grid-cols-4">
        <input className="hidden" name="username" autoComplete="username" tabIndex={-1} aria-hidden="true" />
        <input className="hidden" name="password" type="password" autoComplete="current-password" tabIndex={-1} aria-hidden="true" />
        <input className="input-field" name="new-admin-username" autoComplete="off" placeholder="New admin username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
        <input className="input-field" name="new-admin-display-name" autoComplete="off" placeholder="Display name" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
        <input className="input-field" name="new-admin-password" autoComplete="new-password" placeholder="New admin password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        <button className="rounded bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300" disabled={!form.username || !form.password}>
          Create Admin
        </button>
      </form>

      <Table
        columns={[
          { key: "username", label: "Username" },
          { key: "displayName", label: "Name" },
          { key: "active", label: "Status", render: (admin) => (admin.active ? "Active" : "Inactive") },
          { key: "createdBy", label: "Created by" },
          {
            key: "actions",
            label: "Actions",
            render: (admin) =>
              admin.isMaster ? (
                <span className="text-yellow-400">Protected</span>
              ) : (
                <div className="flex gap-2">
                  <button className="rounded bg-neutral-800 px-3 py-1 text-xs text-white hover:bg-neutral-700" onClick={() => toggle(admin)}>
                    {admin.active ? "Disable" : "Enable"}
                  </button>
                  <button className="rounded bg-red-700 px-3 py-1 text-xs text-white hover:bg-red-600" onClick={() => remove(admin)}>
                    Delete
                  </button>
                </div>
              ),
          },
        ]}
        rows={admins}
      />
    </div>
  );
}

export default function AdminPanel() {
  const [admin, setAdmin] = useState(getSavedAdmin);
  const [activeTab, setActiveTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [data, setData] = useState({});
  const [recordsPage, setRecordsPage] = useState({ rows: [], page: 1, pageSize: 50, total: 0, totalPages: 1 });
  const [prompts, setPrompts] = useState([]);
  const [researchTasks, setResearchTasks] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const token = getAdminToken();

  const load = useCallback(async () => {
    setError("");
    setLoading(true);

    try {
      const [sessionAdmin, overviewData, usersData, rawData, recordsData, promptsData, tasksData, adminsData] = await Promise.all([
        fetchAdminSession(),
        fetchAdminOverview(),
        fetchAdminUsers(),
        fetchAdminData(),
        fetchAdminRecords(1, recordsPage.pageSize || 50),
        fetchAdminPrompts(),
        fetchResearchTasks(),
        fetchAdmins(),
      ]);
      setAdmin(sessionAdmin);
      setOverview(overviewData);
      setUsers(usersData);
      setData(rawData);
      setRecordsPage(recordsData);
      setPrompts(promptsData);
      setResearchTasks(tasksData);
      setAdmins(adminsData);
    } catch (err) {
      setError(err.message || "Unable to load admin panel.");
      if (err.message === "Admin login required.") {
        clearAdminSession();
        navigate("/admin/login", { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }, [navigate, recordsPage.pageSize]);

  useEffect(() => {
    if (token) load();
  }, [load, token]);

  const loadRecordsPage = useCallback(async (page) => {
    try {
      const recordsData = await fetchAdminRecords(page, recordsPage.pageSize || 50);
      setRecordsPage(recordsData);
    } catch (err) {
      setError(err.message || "Unable to load recording records.");
    }
  }, [recordsPage.pageSize]);

  const runExport = useCallback(async (type) => {
    try {
      await exportAdminData(type);
    } catch (err) {
      setError(err.message || "Unable to export data.");
    }
  }, []);

  const currentView = useMemo(() => {
    if (activeTab === "prompts") return <PromptsTab prompts={prompts} onRefresh={load} />;
    if (activeTab === "research") return <ResearchTasksTab tasks={researchTasks} users={users} onRefresh={load} />;
    if (activeTab === "users") return <UsersTab users={users} onRefresh={load} />;
    if (activeTab === "data") return <DataTab data={data} recordsPage={recordsPage} onRecordsPage={loadRecordsPage} onExport={runExport} />;
    if (activeTab === "admins") return <AdminsTab admins={admins} onRefresh={load} />;
    return <OverviewTab overview={overview} />;
  }, [activeTab, overview, users, data, recordsPage, prompts, researchTasks, admins, load, loadRecordsPage, runExport]);

  if (!token) return <Navigate to="/admin/login" replace />;

  const logout = () => {
    clearAdminSession();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0b0d10] px-4 py-5 text-white">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-yellow-300">Project Yaraan</p>
            <h1 className="text-2xl font-semibold">Admin workspace</h1>
            <p className="text-sm text-neutral-400">
              Signed in as {admin?.displayName || admin?.username || "admin"}
              {admin?.isMaster ? " · master admin" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700" onClick={load}>
              Refresh
            </button>
            <button className="rounded bg-red-700 px-3 py-2 text-sm text-white hover:bg-red-600" onClick={logout}>
              Logout
            </button>
          </div>
        </header>

        <nav className="flex flex-wrap gap-2 border-b border-neutral-900 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`rounded-md border px-3 py-2 text-sm font-medium ${
                activeTab === tab.id
                  ? "border-yellow-400 bg-yellow-400 text-black"
                  : "border-neutral-800 bg-neutral-900/70 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-900"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {error && <p className="rounded bg-red-950 px-3 py-2 text-sm text-red-200">{error}</p>}
        {loading ? <p className="text-neutral-400">Loading admin data...</p> : currentView}
      </div>
    </div>
  );
}
