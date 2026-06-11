import { Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import Dashboard from "./Dashboard";
import { getRoleLabel, normalizeUserRole, USER_ROLES } from "../utils/roles";

const dashboardCopy = {
  [USER_ROLES.CONTENT_CONTRIBUTOR]: {
    title: "Content Contributor Dashboard",
    description:
      "Audio and video upload tools will appear here once the contribution flow is connected.",
    nextSteps: [
      "Upload or link Burushaski audio/video content",
      "Add transcript and translation notes when available",
      "Track review status for submitted content",
    ],
  },
  [USER_ROLES.RESEARCHER]: {
    title: "Researcher Dashboard",
    description:
      "Fieldwork, interview, and long-form recording tools will appear here once researcher workflows are connected.",
    nextSteps: [
      "Upload interviews, focus groups, and long-form recordings",
      "Add speaker metadata and turn-taking notes",
      "Track transcription, translation, and validation status",
    ],
  },
  [USER_ROLES.ADMIN]: {
    title: "Admin Dashboard",
    description:
      "Administrative monitoring tools will appear here once the database and reporting flow is connected.",
    nextSteps: [
      "Review users by role, dialect, and participation status",
      "Monitor recording and validation progress",
      "Check data balance across dialect and gender groups",
    ],
  },
};

export default function RoleDashboard() {
  const { user } = useUser();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const role = normalizeUserRole(user.role);

  if (role === USER_ROLES.VOLUNTEER) {
    return <Dashboard />;
  }

  const copy = dashboardCopy[role];

  return (
    <div className="min-h-screen bg-neutral-950 text-white px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-2">
          <p className="text-sm text-yellow-400 font-semibold">
            {getRoleLabel(role)}
          </p>
          <h1 className="text-3xl font-bold">{copy.title}</h1>
          <p className="text-neutral-300">{copy.description}</p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-semibold text-yellow-400">
            Planned tools
          </h2>
          <ul className="space-y-3 text-neutral-200">
            {copy.nextSteps.map((step) => (
              <li key={step} className="flex gap-3">
                <span className="text-yellow-400">-</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-neutral-400">
          Dashboard tools for this role are being connected.
        </p>
      </div>
    </div>
  );
}
