import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  clearAdminSession,
  applyResearchTask,
  approvePromptCorrection,
  createAdminAccount,
  createPrompt,
  createResearchTask,
  deactivatePrompt,
  deleteAdminAccount,
  deleteAdminUser,
  fetchAdminData,
  fetchAdminCorrections,
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
  { id: "prompts", label: "Volunteers" },
  { id: "research", label: "Researchers" },
  { id: "cc", label: "Content Creator Inputs" },
  { id: "users", label: "Participants" },
  { id: "data", label: "Records" },
  { id: "admins", label: "Admin Accounts" },
];

const dialectOptions = [
  { value: "", label: "All dialects" },
  { value: "hunza", label: "Hunza" },
  { value: "nagar", label: "Nagar" },
  { value: "yasin", label: "Yasin" },
];

const promptTypeOptions = [
  { value: "translation", label: "Speak an English sentence" },
  { value: "picture_description", label: "Describe an image" },
];

const defaultPromptGroups = [
  "Reflexive",
  "ECV",
  "Classifiers",
  "Interrogatives",
  "Adjectives",
  "Adverbs",
  "Possession",
  "Postpositions",
  "General Prompts",
  "Image Prompts",
];

const DEFAULT_IMAGE_PROMPT_TEXT =
  "Describe what is happening in this image. There are no right or wrong answers.";

const participantRoleOptions = [
  USER_ROLES.VOLUNTEER,
  USER_ROLES.CONTENT_CONTRIBUTOR,
  USER_ROLES.RESEARCHER,
];

const emptyPrompt = {
  promptId: "",
  moduleId: "image-prompts",
  moduleTitle: "Image Prompts",
  promptType: "picture_description",
  legacyPromptType: "",
  dialect: "",
  english: DEFAULT_IMAGE_PROMPT_TEXT,
  transliteration: "",
  mediaUrl: "",
  mediaType: "image",
  difficulty: "medium",
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
  recordingId: null,
  requestedOutputs: [],
  sourceType: "audio",
  sourceRef: "",
  sourceText: "",
  instructions: "",
  status: "todo",
  priority: "normal",
  dueDate: "",
  transcript: "",
  translation: "",
  researcherNotes: "",
  adminFeedback: "",
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
  ["placeOfOrigin", "Place of origin"],
  ["comfortLanguage", "Comfort language"],
  ["active", "Account status"],
];

const normalize = (value) => String(value || "").toLowerCase();
const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || ""));

function uniq(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function slugify(value, fallback = "general-prompts") {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

function promptGroupLabel(value, fallback = "General Prompts") {
  const label = String(value || "").trim();
  return label === "Admin Prompts" ? "General Prompts" : label || fallback;
}

function isAdminAuthError(error) {
  const message = error?.message || "";
  return message === "Admin login required." || message === "Admin account is inactive.";
}

function promptTypeLabel(value) {
  return value === "picture_description" ? "Describe an image" : value ? "Speak an English sentence" : "-";
}

function promptTypeFilterValue(value) {
  return value === "picture_description" ? "picture_description" : "translation";
}

function dialectLabel(value) {
  const option = dialectOptions.find((item) => item.value === value);
  if (option) return option.label;
  return value ? String(value).charAt(0).toUpperCase() + String(value).slice(1) : "-";
}

function matchesText(row, query, fields) {
  if (!query.trim()) return true;
  const needle = normalize(query);
  return fields.some((field) => normalize(row[field]).includes(needle));
}

function sortedRows(rows, sort, valueFor = (row, key) => row[key] || "") {
  return [...rows].sort((a, b) => {
    const aValue = valueFor(a, sort.key);
    const bValue = valueFor(b, sort.key);
    const order = sort.direction === "asc" ? 1 : -1;

    if (typeof aValue === "number" || typeof bValue === "number") {
      return (Number(aValue) - Number(bValue)) * order;
    }

    return String(aValue || "").localeCompare(String(bValue || ""), undefined, { numeric: true, sensitivity: "base" }) * order;
  });
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

function Table({ columns, rows, emptyText = "No data yet.", sort, onSort }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-800">
      <table className="min-w-full divide-y divide-neutral-800 text-sm">
        <thead className="bg-neutral-950 text-left text-xs uppercase text-neutral-400">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-3 font-semibold">
                {column.sortable && onSort ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left font-semibold uppercase text-neutral-300 hover:text-white"
                    onClick={() => onSort(column.key)}
                  >
                    <span>{column.label}</span>
                    <span className="text-[10px] text-neutral-500">
                      {sort?.key === column.key ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
                    </span>
                  </button>
                ) : (
                  column.label
                )}
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
                    {column.render ? column.render(row) : row[column.key] ?? "-"}
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

function OverviewTab({ overview, prompts }) {
  const totals = overview?.totals || {};
  const usersByRole = overview?.usersByRole || {};
  const roleRows = participantRoleOptions.map((role) => ({
    role: getRoleLabel(role),
    count: usersByRole[role] || 0,
  }));
  const dialectRows = Object.entries(overview?.usersByDialect || {}).map(([dialect, count]) => ({
    dialect: dialectLabel(dialect === "unknown" ? "" : dialect),
    count,
  }));
  const recordingModuleRows = Object.entries(overview?.recordingsByModule || {})
    .map(([module, count]) => ({ module, count }))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Stat label="Volunteers" value={usersByRole[USER_ROLES.VOLUNTEER] || 0} />
        <Stat label="Researchers" value={usersByRole[USER_ROLES.RESEARCHER] || 0} />
        <Stat label="Content creators" value={usersByRole[USER_ROLES.CONTENT_CONTRIBUTOR] || 0} />
        <Stat label="Recordings" value={totals.recordings || 0} />
        <Stat label="Validations" value={totals.validations || 0} />
        <Stat label="Active prompts" value={(prompts || []).filter((prompt) => prompt.active).length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Table columns={[{ key: "role", label: "Participant role" }, { key: "count", label: "People" }]} rows={roleRows} />
        <Table columns={[{ key: "dialect", label: "Dialect" }, { key: "count", label: "People" }]} rows={dialectRows} />
        <Table
          columns={[{ key: "module", label: "Recording group" }, { key: "count", label: "Recordings" }]}
          rows={recordingModuleRows}
          emptyText="No recordings collected yet."
        />
      </div>
    </div>
  );
}

function PromptsTab({ prompts, onRefresh, onAuthError }) {
  const [form, setForm] = useState(emptyPrompt);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ search: "", dialect: "all", type: "all", status: "active" });
  const [groupMode, setGroupMode] = useState("Image Prompts");
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [sort, setSort] = useState({ key: "moduleTitle", direction: "asc" });
  const [error, setError] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [imageFiles, setImageFiles] = useState([]);
  const [imageQueue, setImageQueue] = useState([]);
  const imageInputRef = useRef(null);

  const promptGroups = useMemo(
    () => uniq([
      ...defaultPromptGroups,
      ...prompts
        .map((prompt) => prompt.moduleTitle || prompt.moduleId)
        .filter((group) => group !== "Admin Prompts"),
    ]),
    [prompts]
  );
  const filterDialects = useMemo(() => uniq(prompts.map((prompt) => prompt.dialect || "all dialects")), [prompts]);
  const filteredPrompts = useMemo(
    () =>
      prompts.filter((prompt) => {
        const dialect = prompt.dialect || "all dialects";
        const status = prompt.active ? "active" : "inactive";
        const promptForSearch = { ...prompt, moduleTitle: promptGroupLabel(prompt.moduleTitle || prompt.moduleId) };
        return (
          matchesText(promptForSearch, filters.search, ["promptId", "moduleTitle", "english", "transliteration", "grammaticalCategory"]) &&
          (filters.dialect === "all" || dialect === filters.dialect) &&
          (filters.type === "all" || promptTypeFilterValue(prompt.promptType) === filters.type) &&
          (filters.status === "all" || status === filters.status)
        );
      }),
    [filters, prompts]
  );
  const sortedPrompts = useMemo(() => {
    const valueFor = (prompt, key) => {
      if (key === "promptType") return promptTypeLabel(prompt.promptType);
      if (key === "dialect") return dialectLabel(prompt.dialect);
      if (key === "active") return prompt.active ? "active" : "inactive";
      if (key === "recordingCount") return Number(prompt.recordingCount || 0);
      if (key === "moduleTitle") return promptGroupLabel(prompt.moduleTitle || prompt.moduleId);
      return prompt[key] || "";
    };

    return [...filteredPrompts].sort((a, b) => {
      const aValue = valueFor(a, sort.key);
      const bValue = valueFor(b, sort.key);
      const order = sort.direction === "asc" ? 1 : -1;

      if (typeof aValue === "number" || typeof bValue === "number") {
        return (Number(aValue) - Number(bValue)) * order;
      }

      return String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: "base" }) * order;
    });
  }, [filteredPrompts, sort]);

  const promptStats = useMemo(
    () => ({
      active: prompts.filter((prompt) => prompt.active).length,
      image: prompts.filter((prompt) => prompt.mediaType === "image" || prompt.promptType === "picture_description").length,
      dialects: uniq(prompts.map((prompt) => prompt.dialect)).length,
    }),
    [prompts]
  );

  const updatePromptGroup = (value) => {
    setGroupMode(value);

    if (value === "__new__") {
      const title = newGroupTitle.trim();
      setForm({
        ...form,
        moduleTitle: title,
        moduleId: slugify(title),
        grammaticalCategory: title,
        curriculumStage: title,
      });
      return;
    }

    const isImagePrompt = value === "Image Prompts";
    setForm({
      ...form,
      moduleTitle: value,
      moduleId: slugify(value),
      grammaticalCategory: value,
      curriculumStage: value,
      promptType: isImagePrompt ? "picture_description" : "translation",
      mediaType: isImagePrompt ? "image" : "none",
      mediaUrl: isImagePrompt ? form.mediaUrl : "",
      difficulty: isImagePrompt ? "medium" : "short",
      english: isImagePrompt
        ? form.english.trim() ? form.english : DEFAULT_IMAGE_PROMPT_TEXT
        : form.english === DEFAULT_IMAGE_PROMPT_TEXT ? "" : form.english,
    });
  };

  const updateNewGroupTitle = (value) => {
    setNewGroupTitle(value);
    setForm({
      ...form,
      moduleTitle: value,
      moduleId: slugify(value),
      grammaticalCategory: value,
      curriculumStage: value,
    });
  };

  const updatePromptType = (value) => {
    const isImagePrompt = value === "picture_description";

    setForm({
      ...form,
      promptType: value,
      mediaType: isImagePrompt ? "image" : "none",
      mediaUrl: isImagePrompt ? form.mediaUrl : "",
      difficulty: isImagePrompt ? "medium" : "short",
    });
  };

  const toggleSort = (key) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const resetPromptForm = (imagePromptText = DEFAULT_IMAGE_PROMPT_TEXT) => {
    setForm({ ...emptyPrompt, english: imagePromptText });
    setEditingId(null);
    setGroupMode("Image Prompts");
    setNewGroupTitle("");
    setImageFiles([]);
    setImageQueue([]);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setError("");

    try {
      if (
        !editingId &&
        form.promptType === "picture_description" &&
        imageFiles.length > 1 &&
        form.transliteration.trim()
      ) {
        setError("Upload one image at a time when using an image-specific sub-prompt.");
        return;
      }

      const groupTitle = promptGroupLabel(groupMode === "__new__" ? newGroupTitle : form.moduleTitle);
      const payload = {
        ...form,
        promptId: form.promptId || undefined,
        promptType: form.promptType === "picture_description"
          ? "picture_description"
          : form.legacyPromptType && form.legacyPromptType !== "picture_description"
            ? form.legacyPromptType
            : "translation",
        legacyPromptType: undefined,
        moduleTitle: groupTitle,
        moduleId: slugify(groupTitle),
        grammaticalCategory: groupTitle,
        curriculumStage: groupTitle,
        mediaType: form.promptType === "picture_description" ? "image" : "none",
        mediaUrl: form.promptType === "picture_description" ? form.mediaUrl : "",
        difficulty: form.promptType === "picture_description" ? "medium" : "short",
        weight: 1,
        sortOrder: form.sortOrder || 0,
      };

      if (editingId) {
        if (imageFiles.length > 1) {
          setError("Choose one image when editing an existing prompt. Multiple images create new prompts.");
          return;
        }

        const media = imageFiles.length ? await uploadPromptMedia(imageFiles[0]) : null;
        await updatePrompt(editingId, {
          ...payload,
          mediaUrl: media ? media.path || media.signedUrl || "" : payload.mediaUrl,
        });
      } else if (form.promptType === "picture_description" && imageFiles.length) {
        setUploadingMedia(true);
        setImageQueue(imageFiles.map((file) => ({ name: file.name, status: "Queued" })));

        let succeeded = 0;
        const results = [];

        for (const file of imageFiles) {
          setImageQueue((current) =>
            current.map((item) => item.name === file.name ? { ...item, status: "Uploading image" } : item)
          );

          try {
            const media = await uploadPromptMedia(file);
            setImageQueue((current) =>
              current.map((item) => item.name === file.name ? { ...item, status: "Creating prompt" } : item)
            );

            await createPrompt({
              ...payload,
              promptId: undefined,
              mediaUrl: media.path || media.signedUrl || "",
            });

            succeeded += 1;
            results.push({ name: file.name, status: "Done" });
            setImageQueue((current) =>
              current.map((item) => item.name === file.name ? { ...item, status: "Done" } : item)
            );
          } catch (err) {
            if (isAdminAuthError(err)) throw err;

            const message = err.message || "Failed";
            results.push({ name: file.name, status: message });
            setImageQueue((current) =>
              current.map((item) => item.name === file.name ? { ...item, status: message } : item)
            );
          }
        }

        setUploadingMedia(false);
        setImageQueue(results);
        if (succeeded !== imageFiles.length) {
          setError(`${succeeded} of ${imageFiles.length} image prompts were created. Review the queue for failed files.`);
          if (succeeded > 0) await onRefresh();
          return;
        }
      } else {
        await createPrompt(payload);
      }

      resetPromptForm(
        !editingId && form.promptType === "picture_description"
          ? form.english
          : DEFAULT_IMAGE_PROMPT_TEXT
      );
      await onRefresh();
    } catch (err) {
      setUploadingMedia(false);
      if (isAdminAuthError(err)) {
        onAuthError?.();
        return;
      }
      setError(err.message || "Unable to save prompt.");
    }
  };

  const edit = (prompt) => {
    setEditingId(prompt.id);
    setForm({
      ...emptyPrompt,
      ...prompt,
      legacyPromptType: prompt.promptType,
      promptType: prompt.promptType === "picture_description" ? "picture_description" : "translation",
      mediaUrl: prompt.mediaPath || prompt.mediaUrl || "",
    });
    setGroupMode(promptGroupLabel(prompt.moduleTitle));
    setNewGroupTitle("");
    setImageFiles([]);
    setImageQueue([]);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  const reactivate = async (prompt) => {
    try {
      await updatePrompt(prompt.id, { active: true });
      await onRefresh();
    } catch (err) {
      setError(err.message || "Unable to reactivate prompt.");
    }
  };

  const updateImageFiles = (event) => {
    setImageFiles(Array.from(event.target.files || []));
    setImageQueue([]);
  };

  const clearImageFiles = () => {
    setImageFiles([]);
    setImageQueue([]);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
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

      <form
        autoComplete="off"
        onSubmit={save}
        className={`space-y-4 rounded-lg border bg-neutral-900/80 p-4 shadow-sm ${
          editingId ? "border-yellow-500/70" : "border-neutral-800"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">
              {editingId ? `Editing prompt ${form.promptId || ""}` : "Add volunteer prompt"}
            </h3>
            <p className="text-xs text-neutral-500">
              Prompt ID and module ID are generated automatically. Volunteers only see the prompt text and image, if one is attached.
            </p>
          </div>
          <Badge tone={form.active ? "green" : "neutral"}>{form.active ? "Active" : "Draft"}</Badge>
        </div>

        {editingId && (
          <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100">
            Edit mode is open here. Saving updates the selected prompt; Cancel returns this form to add-new mode.
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1 text-xs text-neutral-400">
            <span>Prompt group</span>
            <select className="select-field" value={groupMode} onChange={(event) => updatePromptGroup(event.target.value)}>
              {promptGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
              <option value="__new__">New group...</option>
            </select>
          </label>
          {groupMode === "__new__" && (
            <label className="space-y-1 text-xs text-neutral-400">
              <span>New group name</span>
              <input
                className="input-field"
                name="new-prompt-group"
                autoComplete="off"
                placeholder="Example: Daily routines"
                value={newGroupTitle}
                onChange={(event) => updateNewGroupTitle(event.target.value)}
              />
            </label>
          )}
          {form.promptType !== "picture_description" && (
            <label className="space-y-1 text-xs text-neutral-400">
              <span>Task type</span>
              <select className="select-field" value={promptTypeFilterValue(form.promptType)} onChange={(event) => updatePromptType(event.target.value)}>
                {promptTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="space-y-1 text-xs text-neutral-400">
            <span>Dialect</span>
            <select className="select-field" value={form.dialect} onChange={(event) => setForm({ ...form, dialect: event.target.value })}>
              {dialectOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-neutral-400">
            <span>Visibility</span>
            <select className="select-field" value={form.active ? "true" : "false"} onChange={(event) => setForm({ ...form, active: event.target.value === "true" })}>
              <option value="true">Active for volunteers</option>
              <option value="false">Draft / hidden</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs text-neutral-400">
            <span>Volunteer sees</span>
            <textarea
              className="input-field min-h-24"
              name="english-prompt"
              autoComplete="off"
              placeholder={form.promptType === "picture_description" ? "Describe what is happening in this image." : "Enter the instruction or sentence shown to volunteers"}
              value={form.english}
              onChange={(event) => setForm({ ...form, english: event.target.value })}
            />
          </label>
          <label className="space-y-1 text-xs text-neutral-400">
            <span>Optional helper text</span>
            <textarea
              className="input-field min-h-24"
              name="transliteration"
              autoComplete="off"
              placeholder={form.promptType === "picture_description" ? "Add an optional sub-prompt specific to this image" : "Burushaski text, transliteration, or notes volunteers may need"}
              value={form.transliteration}
              onChange={(event) => setForm({ ...form, transliteration: event.target.value })}
            />
          </label>
        </div>

        {form.promptType === "picture_description" && (
          <div className="space-y-3 rounded-md border border-neutral-800 bg-neutral-950/60 p-3">
            <label className="space-y-1 text-xs text-neutral-400">
              <span>Image URL</span>
              <input
                className="input-field"
                name="media-url"
                autoComplete="off"
                placeholder="Paste one public image URL, or upload local image files below"
                value={form.mediaUrl}
                onChange={(event) => setForm({ ...form, mediaUrl: event.target.value })}
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700">
                {uploadingMedia ? "Uploading..." : imageFiles.length ? `${imageFiles.length} image${imageFiles.length === 1 ? "" : "s"} selected` : "Upload image files"}
                <input
                  type="file"
                  multiple={!editingId}
                  ref={imageInputRef}
                  accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,.bmp"
                  className="hidden"
                  disabled={uploadingMedia}
                  onChange={updateImageFiles}
                />
              </label>
              {(imageFiles.length > 0 || imageQueue.length > 0) && (
                <button
                  type="button"
                  className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={uploadingMedia}
                  onClick={clearImageFiles}
                >
                  Clear images
                </button>
              )}
              {isHttpUrl(form.mediaUrl) && (
                <a className="text-sm text-yellow-300 underline" href={form.mediaUrl} target="_blank" rel="noreferrer">
                  Open current media
                </a>
              )}
            </div>
            {imageFiles.length > 1 && (
              <p className="text-xs text-neutral-500">
                These {imageFiles.length} images will be saved as separate prompts with the same group, dialect, visibility, and volunteer text.
              </p>
            )}
            {editingId && imageFiles.length > 1 && (
              <p className="text-xs text-yellow-200">Editing accepts one replacement image at a time.</p>
            )}
            {imageQueue.length > 0 && (
              <div className="max-h-56 overflow-auto rounded-md border border-neutral-800 bg-neutral-950/70">
                <table className="min-w-full divide-y divide-neutral-800 text-sm">
                  <thead className="bg-neutral-950 text-left text-xs uppercase text-neutral-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">File</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {imageQueue.map((item, index) => (
                      <tr key={`${item.name}-${index}`}>
                        <td className="px-3 py-2 text-neutral-300">{item.name}</td>
                        <td className={`px-3 py-2 ${item.status === "Done" ? "text-emerald-300" : item.status === "Queued" || item.status.includes("ing") ? "text-yellow-300" : "text-red-300"}`}>
                          {item.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={
              uploadingMedia ||
              !form.english ||
              (groupMode === "__new__" && !newGroupTitle.trim()) ||
              (form.promptType === "picture_description" && !form.mediaUrl && !imageFiles.length)
            }
          >
            {uploadingMedia ? "Uploading..." : editingId ? "Save Changes" : imageFiles.length > 1 ? `Add ${imageFiles.length} Prompts` : "Add Prompt"}
          </button>
          {editingId && (
            <button type="button" className="rounded bg-neutral-800 px-4 py-2 text-sm text-white hover:bg-neutral-700" onClick={() => resetPromptForm()}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="grid gap-3 rounded-lg border border-neutral-800 bg-neutral-950/70 p-3 md:grid-cols-5">
        <label className="space-y-1 text-xs text-neutral-400 md:col-span-2">
          <span>Search prompts</span>
          <input className="input-field" placeholder="Prompt group, visible text, helper text..." value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        </label>
        <label className="space-y-1 text-xs text-neutral-400">
          <span>Dialect</span>
          <select className="select-field" value={filters.dialect} onChange={(event) => setFilters({ ...filters, dialect: event.target.value })}>
            <option value="all">All dialects</option>
            {filterDialects.map((dialect) => (
              <option key={dialect} value={dialect}>{dialectLabel(dialect === "all dialects" ? "" : dialect)}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-neutral-400">
          <span>Task type</span>
          <select className="select-field" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
            <option value="all">All types</option>
            {promptTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-neutral-400">
          <span>Status</span>
          <select className="select-field" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
            <option value="all">All statuses</option>
          </select>
        </label>
      </div>

      <Table
        columns={[
          { key: "promptId", label: "Prompt", sortable: true, render: (prompt) => <span className="font-mono text-xs">{prompt.promptId}</span> },
          { key: "moduleTitle", label: "Group", sortable: true, render: (prompt) => promptGroupLabel(prompt.moduleTitle || prompt.moduleId) },
          { key: "english", label: "Volunteer sees", sortable: true, render: (prompt) => <span className="block max-w-md text-neutral-300">{prompt.english}</span> },
          { key: "promptType", label: "Type", sortable: true, render: (prompt) => <Badge tone={prompt.promptType === "picture_description" ? "blue" : "neutral"}>{promptTypeLabel(prompt.promptType)}</Badge> },
          { key: "dialect", label: "Dialect", sortable: true, render: (prompt) => dialectLabel(prompt.dialect) },
          { key: "recordingCount", label: "Recordings", sortable: true },
          { key: "active", label: "Status", sortable: true, render: (prompt) => <Badge tone={prompt.active ? "green" : "neutral"}>{prompt.active ? "Active" : "Inactive"}</Badge> },
          {
            key: "actions",
            label: "Actions",
            render: (prompt) => (
              <div className="flex gap-2">
                <button className="rounded bg-neutral-800 px-3 py-1 text-xs text-white hover:bg-neutral-700" onClick={() => edit(prompt)}>Edit</button>
                {prompt.active ? (
                  <button className="rounded bg-red-700 px-3 py-1 text-xs text-white hover:bg-red-600" onClick={() => deactivate(prompt)}>Deactivate</button>
                ) : (
                  <button className="rounded bg-emerald-700 px-3 py-1 text-xs text-white hover:bg-emerald-600" onClick={() => reactivate(prompt)}>Reactivate</button>
                )}
              </div>
            ),
          },
        ]}
        rows={sortedPrompts}
        emptyText="No prompts match these filters."
        sort={sort}
        onSort={toggleSort}
      />
    </div>
  );
}

function ResearchTasksTab({ tasks, users, onRefresh, onOpenRecords, onApply, onComplete }) {
  const researchers = users.filter((user) => user.role === USER_ROLES.RESEARCHER && user.active !== false);
  const [form, setForm] = useState(emptyTask);
  const [editingId, setEditingId] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
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
      setShowAdvanced(false);
      await onRefresh();
    } catch (err) {
      setError(err.message || "Unable to save research task.");
    }
  };

  const edit = (task) => {
    setEditingId(task.id);
    setForm({ ...emptyTask, ...task });
    setShowAdvanced(true);
    setError("");
  };

  const assigneeName = (id) => users.find((user) => user.id === id)?.username || "-";
  const statusLabel = (status) => ({
    todo: "To do",
    in_progress: "In progress",
    review: "Awaiting review",
    done: "Completed",
    blocked: "Needs changes",
  }[status] || status);

  return (
    <div className="space-y-6">
      <PanelHeader
        eyebrow="Research workflow"
        title="Assignments"
        detail={`${tasks.length} total · ${tasks.filter((task) => task.status !== "done").length} open`}
      />

      {error && <p className="rounded bg-red-950 px-3 py-2 text-sm text-red-200">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Unassigned" value={tasks.filter((task) => !task.assignedTo).length} />
        <Stat label="To do" value={tasks.filter((task) => task.status === "todo").length} />
        <Stat label="In progress" value={tasks.filter((task) => task.status === "in_progress").length} />
        <Stat label="Awaiting review" value={tasks.filter((task) => task.status === "review").length} />
        <Stat label="Completed" value={tasks.filter((task) => task.status === "done").length} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300" onClick={onOpenRecords}>
          Assign a recording
        </button>
        <button
          type="button"
          className="rounded bg-neutral-800 px-4 py-2 text-sm text-white hover:bg-neutral-700"
          onClick={() => {
            setShowAdvanced((current) => !current);
            setEditingId(null);
            setForm(emptyTask);
          }}
        >
          {showAdvanced ? "Hide manual task form" : "Create non-recording task"}
        </button>
      </div>

      {showAdvanced && (
      <form autoComplete="off" onSubmit={save} className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4 space-y-4">
        {form.recording && (
          <div className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-950 p-4">
            <div>
              <p className="text-sm font-medium text-white">
                {form.recording.username || form.recording.participantId}
              </p>
              <p className="text-xs text-neutral-500">
                {form.recording.moduleTitle} · Recording #{form.recording.id}
              </p>
            </div>
            <p className="text-sm text-neutral-300">{form.recording.promptText || "Prompt text unavailable"}</p>
            {form.recording.audioUrl && <audio className="w-full" controls src={form.recording.audioUrl} />}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1 text-xs text-neutral-400">
            <span>Task title</span>
            <input className="input-field" name="task-title" autoComplete="off" placeholder="Short assignment name" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <label className="space-y-1 text-xs text-neutral-400">
            <span>Task type</span>
            <select className="select-field" value={form.taskType} onChange={(event) => setForm({ ...form, taskType: event.target.value })}>
              <option value="transcription">Transcription</option>
              <option value="translation">Translation</option>
              <option value="validation">Validation</option>
              <option value="metadata_review">Metadata review</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-neutral-400">
            <span>Assigned to</span>
            <select className="select-field" value={form.assignedTo} onChange={(event) => setForm({ ...form, assignedTo: event.target.value })}>
              <option value="">Unassigned</option>
              {researchers.map((user) => (
                <option key={user.id} value={user.id}>{user.username}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-neutral-400">
            <span>Status</span>
            <select className="select-field" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1 text-xs text-neutral-400">
            <span>Source type</span>
            <select className="select-field" value={form.sourceType} onChange={(event) => setForm({ ...form, sourceType: event.target.value })}>
              <option value="audio">Audio</option>
              <option value="text">Text</option>
              <option value="content_url">Content URL</option>
              <option value="recording">Recording row</option>
              <option value="feedback">Feedback row</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-neutral-400">
            <span>Source reference</span>
            <input className="input-field" name="source-ref" autoComplete="off" placeholder="URL, storage path, or row ID" value={form.sourceRef} onChange={(event) => setForm({ ...form, sourceRef: event.target.value })} />
          </label>
          <label className="space-y-1 text-xs text-neutral-400">
            <span>Priority</span>
            <select className="select-field" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-neutral-400">
            <span>Due date</span>
            <input className="input-field" name="due-date" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs text-neutral-400">
            <span>Source text</span>
            <textarea className="input-field min-h-24" name="source-text" autoComplete="off" placeholder="Text to translate/transcribe, if applicable" value={form.sourceText} onChange={(event) => setForm({ ...form, sourceText: event.target.value })} />
          </label>
          <label className="space-y-1 text-xs text-neutral-400">
            <span>Researcher instructions</span>
            <textarea className="input-field min-h-24" name="instructions" autoComplete="off" placeholder="What should the researcher do?" value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} />
          </label>
          <label className="space-y-1 text-xs text-neutral-400">
            <span>Transcript</span>
            <textarea className="input-field min-h-24" name="transcript" autoComplete="off" placeholder="Burushaski transcript or working notes" value={form.transcript} onChange={(event) => setForm({ ...form, transcript: event.target.value })} />
          </label>
          <label className="space-y-1 text-xs text-neutral-400">
            <span>English translation</span>
            <textarea className="input-field min-h-24" name="translation" autoComplete="off" placeholder="English translation" value={form.translation} onChange={(event) => setForm({ ...form, translation: event.target.value })} />
          </label>
        </div>

        <label className="block space-y-1 text-xs text-neutral-400">
          <span>Internal notes</span>
          <textarea className="input-field min-h-20" name="notes" autoComplete="off" placeholder="Admin-only notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </label>
        {editingId && (
          <label className="block space-y-1 text-xs text-neutral-400">
            <span>Feedback visible to researcher</span>
            <textarea className="input-field min-h-20" value={form.adminFeedback} onChange={(event) => setForm({ ...form, adminFeedback: event.target.value })} placeholder="Explain requested changes or review outcome" />
          </label>
        )}

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
      )}

      <div className="grid gap-3 rounded-lg border border-neutral-800 bg-neutral-950/70 p-3 md:grid-cols-5">
        <label className="space-y-1 text-xs text-neutral-400 md:col-span-2">
          <span>Search assignments</span>
          <input className="input-field" placeholder="Task, source text, notes..." value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        </label>
        <label className="space-y-1 text-xs text-neutral-400">
          <span>Assignee</span>
          <select className="select-field" value={filters.assignedTo} onChange={(event) => setFilters({ ...filters, assignedTo: event.target.value })}>
            <option value="all">All assignees</option>
            <option value="unassigned">Unassigned</option>
            {researchers.map((user) => (
              <option key={user.id} value={user.id}>{user.username}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-neutral-400">
          <span>Status</span>
          <select className="select-field" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="all">All statuses</option>
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="review">Awaiting review</option>
            <option value="done">Done</option>
            <option value="blocked">Needs changes</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-neutral-400">
          <span>Task type</span>
          <select className="select-field" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
            <option value="all">All task types</option>
            <option value="transcription">Transcription</option>
            <option value="translation">Translation</option>
            <option value="validation">Validation</option>
            <option value="metadata_review">Metadata review</option>
          </select>
        </label>
      </div>

      <Table
        columns={[
          { key: "title", label: "Assignment", render: (task) => (
            <div>
              <p className="font-medium text-white">{task.title}</p>
              {task.recording && (
                <p className="text-xs text-neutral-500">
                  {task.recording.username || task.recording.participantId} · {task.recording.moduleTitle}
                </p>
              )}
            </div>
          ) },
          { key: "taskType", label: "Outputs", render: (task) => task.requestedOutputs?.length ? task.requestedOutputs.join(", ") : task.taskType },
          { key: "assignedTo", label: "Assigned", render: (task) => assigneeName(task.assignedTo) },
          { key: "status", label: "Status", render: (task) => <Badge tone={task.status === "done" ? "green" : task.status === "blocked" ? "red" : "yellow"}>{statusLabel(task.status)}</Badge> },
          { key: "priority", label: "Priority", render: (task) => <Badge tone={task.priority === "urgent" || task.priority === "high" ? "red" : "neutral"}>{task.priority}</Badge> },
          { key: "dueDate", label: "Due" },
          { key: "actions", label: "Actions", render: (task) => (
            <div className="flex flex-wrap gap-2">
              <button className="rounded bg-neutral-800 px-3 py-1 text-xs text-white hover:bg-neutral-700" onClick={() => edit(task)}>
                {task.status === "review" ? "Review" : "Edit"}
              </button>
              {task.status === "review" && task.recordingId && task.requestedOutputs?.some((output) => output === "transcript" || output === "translation") && (
                <button className="rounded bg-emerald-700 px-3 py-1 text-xs text-white hover:bg-emerald-600" onClick={() => onApply(task)}>
                  Apply to recording
                </button>
              )}
              {task.status === "review" && (
                <button className="rounded bg-blue-700 px-3 py-1 text-xs text-white hover:bg-blue-600" onClick={() => onComplete(task)}>
                  Approve without applying
                </button>
              )}
            </div>
          ) },
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

  const participantUsers = useMemo(() => users.filter((user) => user.role !== USER_ROLES.ADMIN), [users]);
  const dialects = useMemo(() => uniq(participantUsers.map((user) => user.dialect)), [participantUsers]);
  const filteredUsers = useMemo(
    () =>
      participantUsers.filter((user) => {
        const status = user.active ? "active" : "inactive";
        return (
          matchesText(user, filters.search, ["username", "participantId", "name", "email", "mobileNumber", "placeOfOrigin", "comfortLanguage"]) &&
          (filters.role === "all" || user.role === filters.role) &&
          (filters.dialect === "all" || user.dialect === filters.dialect) &&
          (filters.status === "all" || status === filters.status)
        );
      }),
    [filters, participantUsers]
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
        detail={`${filteredUsers.length} shown · ${participantUsers.length} total`}
      />
      {error && <p className="rounded bg-red-950 px-3 py-2 text-sm text-red-200">{error}</p>}
      <div className="grid gap-3 rounded-lg border border-neutral-800 bg-neutral-950/70 p-3 md:grid-cols-5">
        <label className="space-y-1 text-xs text-neutral-400 md:col-span-2">
          <span>Search participants</span>
          <input className="input-field" placeholder="Username, ID, phone, place..." value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        </label>
        <label className="space-y-1 text-xs text-neutral-400">
          <span>Participant role</span>
          <select className="select-field" value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value })}>
            <option value="all">All roles</option>
            {participantRoleOptions.map((role) => (
              <option key={role} value={role}>{getRoleLabel(role)}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-neutral-400">
          <span>Dialect</span>
          <select className="select-field" value={filters.dialect} onChange={(event) => setFilters({ ...filters, dialect: event.target.value })}>
            <option value="all">All dialects</option>
            {dialects.map((dialect) => (
              <option key={dialect} value={dialect}>{dialectLabel(dialect)}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-neutral-400">
          <span>Status</span>
          <select className="select-field" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
            <option value="all">All statuses</option>
          </select>
        </label>
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
                        {participantRoleOptions.map((role) => (
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
                    ) : key === "dialect" ? (
                      <select
                        className="select-field"
                        value={draft.dialect || ""}
                        onChange={(event) => setDraft({ ...draft, dialect: event.target.value })}
                      >
                        {dialectOptions.map((option) => (
                          <option key={option.value || "blank"} value={option.value}>
                            {option.label}
                          </option>
                        ))}
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
                <p>Dialect: {dialectLabel(user.dialect)}</p>
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

function ContentCreatorTab({ users, recordsPage }) {
  const [filters, setFilters] = useState({ search: "", status: "active" });
  const [sort, setSort] = useState({ key: "username", direction: "asc" });
  const contentCreators = useMemo(
    () => users.filter((user) => user.role === USER_ROLES.CONTENT_CONTRIBUTOR),
    [users]
  );
  const creatorIds = useMemo(
    () => new Set(contentCreators.map((user) => user.participantId)),
    [contentCreators]
  );
  const creatorRecords = useMemo(
    () => (recordsPage.rows || []).filter((recording) => creatorIds.has(recording.participantId)),
    [creatorIds, recordsPage.rows]
  );
  const filteredCreators = useMemo(
    () =>
      contentCreators.filter((user) => {
        const status = user.active ? "active" : "inactive";
        return (
          matchesText(user, filters.search, ["username", "participantId", "name", "email", "mobileNumber", "placeOfOrigin"]) &&
          (filters.status === "all" || filters.status === status)
        );
      }),
    [contentCreators, filters]
  );
  const sortedCreators = useMemo(
    () => sortedRows(filteredCreators, sort, (user, key) => (key === "recordingCount" ? Number(user.recordingCount || 0) : user[key] || "")),
    [filteredCreators, sort]
  );

  const toggleSort = (key) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <div className="space-y-6">
      <PanelHeader
        eyebrow="Content creators"
        title="Content Creator Inputs"
        detail={`${contentCreators.length} content creators · ${creatorRecords.length} records on current page`}
      />

      <div className="grid gap-3 rounded-lg border border-neutral-800 bg-neutral-950/70 p-3 md:grid-cols-3">
        <label className="space-y-1 text-xs text-neutral-400 md:col-span-2">
          <span>Search content creators</span>
          <input
            className="input-field"
            placeholder="Username, participant ID, contact, place..."
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
          />
        </label>
        <label className="space-y-1 text-xs text-neutral-400">
          <span>Status</span>
          <select className="select-field" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
            <option value="all">All statuses</option>
          </select>
        </label>
      </div>

      <Table
        columns={[
          { key: "username", label: "Username", sortable: true },
          { key: "participantId", label: "Participant ID", sortable: true },
          { key: "dialect", label: "Dialect", sortable: true, render: (user) => dialectLabel(user.dialect) },
          { key: "recordingCount", label: "Records", sortable: true },
          { key: "contact", label: "Contact", render: (user) => user.email || user.mobileNumber || "-" },
          { key: "active", label: "Status", sortable: true, render: (user) => <Badge tone={user.active ? "green" : "neutral"}>{user.active ? "Active" : "Inactive"}</Badge> },
        ]}
        rows={sortedCreators}
        emptyText="No content creators match these filters."
        sort={sort}
        onSort={toggleSort}
      />

      <Table
        columns={[
          { key: "participantId", label: "Participant" },
          { key: "moduleTitle", label: "Group", render: (recording) => promptGroupLabel(recording.moduleTitle || recording.moduleId) },
          { key: "promptEnglish", label: "Prompt text", render: (recording) => <span className="block max-w-md">{recording.promptEnglish || "-"}</span> },
          { key: "audioPath", label: "Audio path", render: (recording) => <span className="font-mono text-xs">{recording.audioPath}</span> },
          { key: "createdAt", label: "Created" },
        ]}
        rows={creatorRecords}
        emptyText="No content-creator records on the current records page."
      />
    </div>
  );
}

function RecordingAssignmentModal({ recording, users, onClose, onCreated }) {
  const researchers = users.filter(
    (user) => user.role === USER_ROLES.RESEARCHER && user.active !== false
  );
  const [assignedTo, setAssignedTo] = useState("");
  const [requestedOutputs, setRequestedOutputs] = useState(["transcript", "translation"]);
  const [instructions, setInstructions] = useState("");
  const [priority, setPriority] = useState("normal");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!recording) return null;

  const toggleOutput = (value) => {
    setRequestedOutputs((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  };

  const save = async (event) => {
    event.preventDefault();
    if (!assignedTo || !requestedOutputs.length || saving) return;

    setSaving(true);
    setError("");

    try {
      const outputLabel = requestedOutputs
        .map((value) => value === "metadata_review" ? "metadata review" : value)
        .join(" and ");
      await createResearchTask({
        ...emptyTask,
        title: `${outputLabel.charAt(0).toUpperCase()}${outputLabel.slice(1)} · ${recording.username || recording.participantId}`,
        taskType: requestedOutputs.includes("transcript") ? "transcription" : requestedOutputs.includes("translation") ? "translation" : requestedOutputs[0],
        assignedTo,
        recordingId: recording.id,
        requestedOutputs,
        sourceType: "recording",
        sourceRef: String(recording.id),
        instructions,
        priority,
        dueDate,
        status: "todo",
      });
      await onCreated?.();
      onClose();
    } catch (err) {
      setError(err.message || "Unable to assign recording.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form onSubmit={save} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-auto rounded-xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-yellow-400">Assign recording</p>
            <h3 className="mt-1 text-xl font-semibold text-white">
              {recording.username || recording.participantId}
            </h3>
            <p className="mt-1 text-sm text-neutral-400">
              {dialectLabel(recording.dialect)} · {promptGroupLabel(recording.moduleTitle || recording.moduleId)}
            </p>
          </div>
          <button type="button" className="rounded bg-neutral-800 px-3 py-2 text-sm text-white" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
          <p className="text-sm text-neutral-300">{recording.promptEnglish || "Prompt text unavailable"}</p>
          {recording.audioUrl ? (
            <audio className="mt-3 w-full" controls src={recording.audioUrl} />
          ) : (
            <p className="mt-2 text-xs text-neutral-500">Audio preview is unavailable.</p>
          )}
        </div>

        <label className="block space-y-1 text-sm text-neutral-300">
          <span>Researcher</span>
          <select className="select-field" required value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
            <option value="">Select an active researcher</option>
            {researchers.map((user) => (
              <option key={user.id} value={user.id}>{user.username}</option>
            ))}
          </select>
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm text-neutral-300">Work required</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["transcript", "Burushaski transcript"],
              ["translation", "English translation"],
              ["metadata_review", "Metadata review"],
              ["validation", "Quality validation"],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-200">
                <input type="checkbox" checked={requestedOutputs.includes(value)} onChange={() => toggleOutput(value)} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block space-y-1 text-sm text-neutral-300">
          <span>Instructions for researcher</span>
          <textarea className="input-field min-h-24" value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Optional context, formatting requirements, speaker labels, or quality notes" />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-neutral-300">
            <span>Priority</span>
            <select className="select-field" value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-neutral-300">
            <span>Due date</span>
            <input className="input-field" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>
        </div>

        {researchers.length === 0 && (
          <p className="rounded bg-amber-950 px-3 py-2 text-sm text-amber-200">No active researcher accounts are available.</p>
        )}
        {error && <p className="rounded bg-red-950 px-3 py-2 text-sm text-red-200">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" className="rounded bg-neutral-800 px-4 py-2 text-sm text-white" onClick={onClose}>Cancel</button>
          <button className="rounded bg-yellow-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40" disabled={saving || !assignedTo || !requestedOutputs.length || !researchers.length}>
            {saving ? "Assigning..." : "Assign recording"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DataTab({
  recordsPage,
  correctionsData,
  users,
  prompts,
  recordsLoading,
  correctionsLoading,
  onRecordsPage,
  onCorrectionsLoad,
  onApproveCorrection,
  onAssignmentCreated,
  researchTasks,
}) {
  const [activeView, setActiveView] = useState("records");
  const [filters, setFilters] = useState({ search: "", moduleId: "all", participantId: "all", dialect: "all", role: "all" });
  const [correctionFilters, setCorrectionFilters] = useState({ search: "", participantId: "all", moduleId: "all", promptId: "all" });
  const [recordSort, setRecordSort] = useState({ key: "createdAt", direction: "desc" });
  const [correctionSort, setCorrectionSort] = useState({ key: "count", direction: "desc" });
  const [assignmentRecording, setAssignmentRecording] = useState(null);
  const recordings = useMemo(() => recordsPage.rows || [], [recordsPage.rows]);
  const corrections = useMemo(() => correctionsData.corrections || [], [correctionsData.corrections]);
  const correctionGroups = useMemo(() => correctionsData.groups || [], [correctionsData.groups]);
  const modules = useMemo(() => uniq(prompts.map((prompt) => prompt.moduleId)), [prompts]);
  const participants = useMemo(() => uniq(users.filter((user) => user.role !== USER_ROLES.ADMIN).map((user) => user.participantId)), [users]);
  const promptOptions = useMemo(
    () => uniq(prompts.filter((prompt) => correctionFilters.moduleId === "all" || prompt.moduleId === correctionFilters.moduleId).map((prompt) => prompt.promptId)),
    [correctionFilters.moduleId, prompts]
  );
  const sortedRecordings = useMemo(
    () => sortedRows(recordings, recordSort, (recording, key) => recording[key] || ""),
    [recordings, recordSort]
  );
  const sortedCorrectionGroups = useMemo(
    () => sortedRows(correctionGroups, correctionSort, (group, key) => (key === "count" ? Number(group.count || 0) : group[key] || "")),
    [correctionGroups, correctionSort]
  );

  const toggleRecordSort = (key) => {
    setRecordSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const applyRecordFilters = async (page = 1) => {
    await onRecordsPage(page, {
      search: filters.search,
      moduleId: filters.moduleId,
      participantId: filters.participantId,
      dialect: filters.dialect,
      role: filters.role,
    });
  };

  const applyCorrectionFilters = async () => {
    await onCorrectionsLoad({
      search: correctionFilters.search,
      participantId: correctionFilters.participantId,
      moduleId: correctionFilters.moduleId,
      promptId: correctionFilters.promptId,
    });
  };

  const clearRecordFilters = () => {
    const cleared = { search: "", moduleId: "all", participantId: "all", dialect: "all", role: "all" };
    setFilters(cleared);
    onRecordsPage(1, cleared);
  };

  const clearCorrectionFilters = () => {
    const cleared = { search: "", participantId: "all", moduleId: "all", promptId: "all" };
    setCorrectionFilters(cleared);
    onCorrectionsLoad(cleared);
  };

  const toggleCorrectionSort = (key) => {
    setCorrectionSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <div className="space-y-6">
      <PanelHeader
        eyebrow="Collected data"
        title="Records"
        detail={`${recordsPage.total || 0} total recordings · page ${recordsPage.page || 1} of ${recordsPage.totalPages || 1}`}
      />

      <div className="flex flex-wrap gap-2">
        {[
          { id: "records", label: "Received records" },
          { id: "corrections", label: `Corrections (${correctionsData.total || 0})` },
        ].map((view) => (
          <button
            key={view.id}
            type="button"
            className={`rounded-md border px-3 py-2 text-sm font-medium ${
              activeView === view.id
                ? "border-yellow-400 bg-yellow-400 text-black"
                : "border-neutral-800 bg-neutral-900/70 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-900"
            }`}
            onClick={() => setActiveView(view.id)}
          >
            {view.label}
          </button>
        ))}
      </div>

      {activeView === "records" ? (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-neutral-800 bg-neutral-950/70 p-3 md:grid-cols-6">
            <label className="space-y-1 text-xs text-neutral-400 md:col-span-2">
              <span>Search records</span>
              <input className="input-field" placeholder="Participant, username, group, prompt, transcript..." value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
            </label>
            <label className="space-y-1 text-xs text-neutral-400">
              <span>Prompt group</span>
              <select className="select-field" value={filters.moduleId} onChange={(event) => setFilters({ ...filters, moduleId: event.target.value })}>
                <option value="all">All groups</option>
                {modules.map((moduleId) => (
                  <option key={moduleId} value={moduleId}>{moduleId}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-neutral-400">
              <span>Dialect</span>
              <select className="select-field" value={filters.dialect} onChange={(event) => setFilters({ ...filters, dialect: event.target.value })}>
                <option value="all">All dialects</option>
                {dialectOptions.filter((option) => option.value).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-neutral-400">
              <span>Role</span>
              <select className="select-field" value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value })}>
                <option value="all">All roles</option>
                {participantRoleOptions.map((role) => (
                  <option key={role} value={role}>{getRoleLabel(role)}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-neutral-400">
              <span>Participant</span>
              <select className="select-field" value={filters.participantId} onChange={(event) => setFilters({ ...filters, participantId: event.target.value })}>
                <option value="all">All participants</option>
                {participants.map((participantId) => (
                  <option key={participantId} value={participantId}>{participantId}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2 md:col-span-6">
              <button
                type="button"
                className="rounded bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={recordsLoading}
                onClick={() => applyRecordFilters(1)}
              >
                {recordsLoading ? "Applying..." : "Apply filters"}
              </button>
              <button
                type="button"
                className="rounded bg-neutral-800 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={recordsLoading}
                onClick={clearRecordFilters}
              >
                Clear
              </button>
            </div>
          </div>

          <Table
            columns={[
              { key: "participantId", label: "Participant", sortable: true, render: (recording) => (
                <div>
                  <p className="font-medium">{recording.username || recording.participantId}</p>
                  <p className="text-xs text-neutral-500">{recording.participantId}</p>
                </div>
              ) },
              { key: "dialect", label: "Dialect", sortable: true, render: (recording) => dialectLabel(recording.dialect) },
              { key: "moduleTitle", label: "Group", sortable: true, render: (recording) => promptGroupLabel(recording.moduleTitle || recording.moduleId) },
              { key: "sentenceId", label: "Prompt", sortable: true },
              { key: "promptType", label: "Type", sortable: true, render: (recording) => promptTypeLabel(recording.promptType) },
              { key: "promptEnglish", label: "Prompt text", sortable: true, render: (recording) => <span className="block max-w-md">{recording.promptEnglish || "-"}</span> },
              { key: "transcript", label: "Transcript", sortable: true, render: (recording) => <span className="block max-w-md">{recording.transcript || "-"}</span> },
              { key: "englishTranslation", label: "Translation", sortable: true, render: (recording) => <span className="block max-w-md">{recording.englishTranslation || "-"}</span> },
              { key: "suggestedCorrection", label: "Correction", sortable: true, render: (recording) => recording.correctionFlag ? <span className="block max-w-md text-yellow-200">{recording.suggestedCorrection || "Flagged"}</span> : "-" },
              {
                key: "validationCount",
                label: "Validation received",
                sortable: true,
                render: (recording) => (
                  <div className={recording.validationCount ? "space-y-1 text-emerald-300" : "text-neutral-500"}>
                    <p>
                      {recording.validationCount || 0} received · Yes {recording.validationYes || 0} · No {recording.validationNo || 0}
                    </p>
                    {recording.validationCount > 0 && <p className="text-xs text-neutral-400">Score {recording.validationScore || 0}</p>}
                    {(recording.validations || []).length > 0 && (
                      <div className="space-y-0.5 text-xs text-neutral-400">
                        {(recording.validations || []).slice(0, 3).map((validation, index) => (
                          <p key={`${validation.validatorId || validation.validatorUsername}-${index}`}>
                            {validation.validatorUsername || validation.validatorId}: {validation.vote === "yes" ? "accepted" : validation.vote === "no" ? "rejected" : "neutral"}
                          </p>
                        ))}
                        {recording.validations.length > 3 && <p>+{recording.validations.length - 3} more</p>}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "audioPath",
                label: "Audio",
                sortable: true,
                render: (recording) =>
                  recording.audioUrl ? (
                    <a className="text-yellow-300 underline" href={recording.audioUrl} target="_blank" rel="noreferrer">
                      Open audio
                    </a>
                  ) : (
                    <span className="font-mono text-xs">{recording.audioPath}</span>
                  ),
              },
              { key: "createdAt", label: "Created", sortable: true },
              {
                key: "assignments",
                label: "Research",
                render: (recording) => {
                  const linked = (researchTasks || []).filter((task) => task.recordingId === recording.id);
                  return linked.length
                    ? <Badge tone={linked.some((task) => task.status === "review") ? "yellow" : linked.every((task) => task.status === "done") ? "green" : "blue"}>{linked.length} assigned</Badge>
                    : <span className="text-xs text-neutral-500">Unassigned</span>;
                },
              },
              {
                key: "actions",
                label: "Actions",
                render: (recording) => (
                  <button
                    type="button"
                    className="rounded bg-yellow-400 px-3 py-1.5 text-xs font-semibold text-black hover:bg-yellow-300"
                    onClick={() => setAssignmentRecording(recording)}
                  >
                    Assign to researcher
                  </button>
                ),
              },
            ]}
            rows={sortedRecordings}
            emptyText="No recordings yet."
            sort={recordSort}
            onSort={toggleRecordSort}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-500">
              Showing {sortedRecordings.length} rows on this page from {recordsPage.total || 0} matching records.
            </p>
            <div className="flex gap-2">
              <button
                className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-40"
                disabled={recordsLoading || (recordsPage.page || 1) <= 1}
                onClick={() => applyRecordFilters((recordsPage.page || 1) - 1)}
              >
                Previous
              </button>
              <button
                className="rounded bg-neutral-800 px-3 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-40"
                disabled={recordsLoading || (recordsPage.page || 1) >= (recordsPage.totalPages || 1)}
                onClick={() => applyRecordFilters((recordsPage.page || 1) + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-neutral-800 bg-neutral-950/70 p-3 md:grid-cols-4">
            <label className="space-y-1 text-xs text-neutral-400">
              <span>Search corrections</span>
              <input className="input-field" placeholder="Participant, correction text, date..." value={correctionFilters.search} onChange={(event) => setCorrectionFilters({ ...correctionFilters, search: event.target.value })} />
            </label>
            <label className="space-y-1 text-xs text-neutral-400">
              <span>Participant</span>
              <select className="select-field" value={correctionFilters.participantId} onChange={(event) => setCorrectionFilters({ ...correctionFilters, participantId: event.target.value })}>
                <option value="all">All participants</option>
                {participants.map((participantId) => (
                  <option key={participantId} value={participantId}>{participantId}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-neutral-400">
              <span>Prompt group</span>
              <select className="select-field" value={correctionFilters.moduleId} onChange={(event) => setCorrectionFilters({ ...correctionFilters, moduleId: event.target.value, promptId: "all" })}>
                <option value="all">All groups</option>
                {modules.map((moduleId) => (
                  <option key={moduleId} value={moduleId}>{moduleId}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-neutral-400">
              <span>Prompt</span>
              <select className="select-field" value={correctionFilters.promptId} onChange={(event) => setCorrectionFilters({ ...correctionFilters, promptId: event.target.value })}>
                <option value="all">All prompts</option>
                {promptOptions.map((promptId) => (
                  <option key={promptId} value={promptId}>{promptId}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2 md:col-span-4">
              <button
                type="button"
                className="rounded bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={correctionsLoading}
                onClick={applyCorrectionFilters}
              >
                {correctionsLoading ? "Applying..." : "Apply filters"}
              </button>
              <button
                type="button"
                className="rounded bg-neutral-800 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={correctionsLoading}
                onClick={clearCorrectionFilters}
              >
                Clear
              </button>
            </div>
          </div>

          <Table
            columns={[
              { key: "moduleTitle", label: "Group", sortable: true, render: (group) => promptGroupLabel(group.moduleTitle || group.moduleId) },
              { key: "promptId", label: "Prompt", sortable: true },
              { key: "currentPrompt", label: "Current volunteer text", sortable: true, render: (group) => <span className="block max-w-md">{group.currentPrompt || "-"}</span> },
              { key: "count", label: "Corrections", sortable: true },
              {
                key: "candidates",
                label: "Candidates",
                render: (group) => (
                  <div className="space-y-2">
                    {group.candidates.map((candidate) => (
                      <div key={candidate.text} className="rounded border border-neutral-800 bg-neutral-950/60 p-2">
                        <p className="text-sm text-neutral-200">{candidate.text}</p>
                        <p className="text-xs text-neutral-500">{candidate.count} suggestion{candidate.count === 1 ? "" : "s"}</p>
                        <button
                          className="mt-2 rounded bg-yellow-400 px-3 py-1 text-xs font-semibold text-black hover:bg-yellow-300"
                          onClick={() =>
                            onApproveCorrection(
                              {
                                moduleId: group.moduleId,
                                promptId: group.promptId,
                                correction: candidate.text,
                                feedbackId: candidate.feedbackIds[0],
                              },
                              correctionFilters
                            )
                          }
                        >
                          Approve
                        </button>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                key: "history",
                label: "Approval history",
                render: (group) =>
                  group.history.length ? (
                    <div className="space-y-1 text-xs text-neutral-400">
                      {group.history.slice(0, 3).map((item) => (
                        <p key={item.id}>
                          {item.createdAt}: {item.previousEnglish || "-"} → {item.acceptedCorrection}
                        </p>
                      ))}
                    </div>
                  ) : (
                    "-"
                  ),
              },
            ]}
            rows={sortedCorrectionGroups}
            emptyText="No corrections yet."
            sort={correctionSort}
            onSort={toggleCorrectionSort}
          />

          <Table
            columns={[
              { key: "participantId", label: "Participant" },
              { key: "moduleTitle", label: "Group", render: (correction) => promptGroupLabel(correction.moduleTitle || correction.moduleId) },
              { key: "promptId", label: "Prompt" },
              { key: "correction", label: "Suggested correction", render: (correction) => <span className="block max-w-md">{correction.correction}</span> },
              { key: "createdAt", label: "Created" },
            ]}
            rows={corrections}
            emptyText="No individual correction rows match these filters."
          />
        </div>
      )}
      <RecordingAssignmentModal
        recording={assignmentRecording}
        users={users}
        onClose={() => setAssignmentRecording(null)}
        onCreated={onAssignmentCreated}
      />
    </div>
  );
}

function AdminsTab({ admins, currentAdmin, onRefresh }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [passwordDrafts, setPasswordDrafts] = useState({});
  const [error, setError] = useState("");

  const create = async (event) => {
    event.preventDefault();
    setError("");

    try {
      await createAdminAccount(form);
      setForm({ username: "", password: "" });
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

  const changePassword = async (admin) => {
    const password = passwordDrafts[admin.id] || "";
    setError("");

    try {
      await updateAdminAccount(admin.id, { password });
      setPasswordDrafts({ ...passwordDrafts, [admin.id]: "" });
      await onRefresh();
    } catch (err) {
      setError(err.message || "Unable to update password.");
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
      {currentAdmin?.isMaster && (
        <form autoComplete="off" onSubmit={create} className="grid gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4 md:grid-cols-3">
          <input className="hidden" name="username" autoComplete="username" tabIndex={-1} aria-hidden="true" />
          <input className="hidden" name="password" type="password" autoComplete="current-password" tabIndex={-1} aria-hidden="true" />
          <label className="space-y-1 text-xs text-neutral-400">
            <span>New admin username</span>
            <input className="input-field" name="new-admin-username" autoComplete="off" placeholder="example-admin" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          </label>
          <label className="space-y-1 text-xs text-neutral-400">
            <span>Temporary password</span>
            <input className="input-field" name="new-admin-password" autoComplete="new-password" placeholder="At least 10 characters" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>
          <div className="flex items-end">
            <button className="w-full rounded bg-yellow-400 px-4 py-3 text-sm font-semibold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50" disabled={!form.username || form.password.length < 10}>
              Create Admin
            </button>
          </div>
        </form>
      )}

      <Table
        columns={[
          { key: "username", label: "Username" },
          { key: "active", label: "Status", render: (admin) => (admin.active ? "Active" : "Inactive") },
          { key: "createdBy", label: "Created by" },
          {
            key: "actions",
            label: "Actions",
            render: (admin) => {
              const isSelf = currentAdmin?.id === admin.id;
              const canManage = !admin.isMaster && (currentAdmin?.isMaster || isSelf);
              const canChangePassword = canManage;
              const canToggle = !admin.isMaster && (currentAdmin?.isMaster || isSelf);

              if (admin.isMaster) {
                return <span className="text-yellow-400">Password managed in env</span>;
              }

              if (!canManage) {
                return <span className="text-neutral-500">Only master admin can manage this account</span>;
              }

              return (
                <div className="flex flex-wrap gap-2">
                  {canToggle && (
                  <button className="rounded bg-neutral-800 px-3 py-1 text-xs text-white hover:bg-neutral-700" onClick={() => toggle(admin)}>
                    {admin.active ? "Disable" : "Enable"}
                  </button>
                  )}
                  {canChangePassword && (
                    <>
                      <input
                        className="input-field max-w-48 py-1 text-xs"
                        type="password"
                        autoComplete="new-password"
                        placeholder="New password"
                        value={passwordDrafts[admin.id] || ""}
                        onChange={(event) => setPasswordDrafts({ ...passwordDrafts, [admin.id]: event.target.value })}
                      />
                      <button
                        className="rounded bg-yellow-400 px-3 py-1 text-xs font-semibold text-black hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={(passwordDrafts[admin.id] || "").length < 10}
                        onClick={() => changePassword(admin)}
                      >
                        Set password
                      </button>
                    </>
                  )}
                  <button className="rounded bg-red-700 px-3 py-1 text-xs text-white hover:bg-red-600" onClick={() => remove(admin)}>
                    Disable
                  </button>
                </div>
              );
            },
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
  const [correctionsData, setCorrectionsData] = useState({ corrections: [], groups: [], total: 0 });
  const [prompts, setPrompts] = useState([]);
  const [researchTasks, setResearchTasks] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [correctionsLoading, setCorrectionsLoading] = useState(false);
  const [error, setError] = useState("");
  const recordsRequestId = useRef(0);
  const correctionsRequestId = useRef(0);
  const navigate = useNavigate();

  const token = getAdminToken();

  const handleAuthError = useCallback(() => {
    clearAdminSession();
    navigate("/admin/login", { replace: true });
  }, [navigate]);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);

    try {
      const [sessionAdmin, overviewData, usersData, rawData, recordsData, correctionsResult, promptsData, tasksData, adminsData] = await Promise.all([
        fetchAdminSession(),
        fetchAdminOverview(),
        fetchAdminUsers(),
        fetchAdminData(),
        fetchAdminRecords(1, recordsPage.pageSize || 50),
        fetchAdminCorrections(),
        fetchAdminPrompts(),
        fetchResearchTasks(),
        fetchAdmins(),
      ]);
      setAdmin(sessionAdmin);
      setOverview(overviewData);
      setUsers(usersData);
      setData(rawData);
      setRecordsPage(recordsData);
      setCorrectionsData(correctionsResult);
      setPrompts(promptsData);
      setResearchTasks(tasksData);
      setAdmins(adminsData);
    } catch (err) {
      setError(err.message || "Unable to load admin panel.");
      if (isAdminAuthError(err)) handleAuthError();
    } finally {
      setLoading(false);
    }
  }, [handleAuthError, recordsPage.pageSize]);

  useEffect(() => {
    if (token) load();
  }, [load, token]);

  const loadRecordsPage = useCallback(async (page, filters = {}) => {
    const requestId = recordsRequestId.current + 1;
    recordsRequestId.current = requestId;
    setRecordsLoading(true);
    try {
      const recordsData = await fetchAdminRecords(page, recordsPage.pageSize || 50, filters);
      if (recordsRequestId.current === requestId) {
        setRecordsPage(recordsData);
      }
    } catch (err) {
      setError(err.message || "Unable to load recording records.");
    } finally {
      if (recordsRequestId.current === requestId) {
        setRecordsLoading(false);
      }
    }
  }, [recordsPage.pageSize]);

  const loadCorrections = useCallback(async (filters = {}) => {
    const requestId = correctionsRequestId.current + 1;
    correctionsRequestId.current = requestId;
    setCorrectionsLoading(true);
    try {
      const correctionsResult = await fetchAdminCorrections(filters);
      if (correctionsRequestId.current === requestId) {
        setCorrectionsData(correctionsResult);
      }
    } catch (err) {
      setError(err.message || "Unable to load corrections.");
    } finally {
      if (correctionsRequestId.current === requestId) {
        setCorrectionsLoading(false);
      }
    }
  }, []);

  const approveCorrection = useCallback(async (payload, filters = {}) => {
    try {
      await approvePromptCorrection(payload);
      await Promise.all([
        loadCorrections(filters),
        fetchAdminPrompts().then(setPrompts),
      ]);
    } catch (err) {
      setError(err.message || "Unable to approve correction.");
    }
  }, [loadCorrections]);

  const applyAssignment = useCallback(async (task) => {
    if (!window.confirm("Apply this researcher submission to the canonical recording and mark the assignment completed?")) return;

    try {
      await applyResearchTask(task.id);
      await load();
    } catch (err) {
      setError(err.message || "Unable to apply researcher work to the recording.");
    }
  }, [load]);

  const completeAssignment = useCallback(async (task) => {
    if (!window.confirm("Approve this assignment without copying its work into the canonical recording?")) return;

    try {
      await updateResearchTask(task.id, { status: "done" });
      await load();
    } catch (err) {
      setError(err.message || "Unable to complete researcher assignment.");
    }
  }, [load]);

  const currentView = useMemo(() => {
    if (activeTab === "prompts") return <PromptsTab prompts={prompts} onRefresh={load} onAuthError={handleAuthError} />;
    if (activeTab === "research") {
      return (
        <ResearchTasksTab
          tasks={researchTasks}
          users={users}
          onRefresh={load}
          onOpenRecords={() => setActiveTab("data")}
          onApply={applyAssignment}
          onComplete={completeAssignment}
        />
      );
    }
    if (activeTab === "cc") return <ContentCreatorTab users={users} recordsPage={recordsPage} />;
    if (activeTab === "users") return <UsersTab users={users} onRefresh={load} />;
    if (activeTab === "data") {
      return (
        <DataTab
          data={data}
          users={users}
          prompts={prompts}
          recordsPage={recordsPage}
          correctionsData={correctionsData}
          recordsLoading={recordsLoading}
          correctionsLoading={correctionsLoading}
          onRecordsPage={loadRecordsPage}
          onCorrectionsLoad={loadCorrections}
          onApproveCorrection={approveCorrection}
          onAssignmentCreated={load}
          researchTasks={researchTasks}
        />
      );
    }
    if (activeTab === "admins") return <AdminsTab admins={admins} currentAdmin={admin} onRefresh={load} />;
    return <OverviewTab overview={overview} prompts={prompts} />;
  }, [activeTab, admin, overview, users, data, recordsPage, correctionsData, prompts, researchTasks, admins, recordsLoading, correctionsLoading, load, loadRecordsPage, loadCorrections, approveCorrection, applyAssignment, completeAssignment, handleAuthError]);

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
            <p className="text-sm font-semibold text-yellow-300">Project Yaraan</p>
            <h1 className="text-2xl font-semibold">Admin Panel</h1>
            <p className="text-sm text-neutral-400">{admin?.username || "admin"}</p>
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
