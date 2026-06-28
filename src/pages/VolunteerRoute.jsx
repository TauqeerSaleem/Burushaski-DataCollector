import { Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { normalizeUserRole, USER_ROLES } from "../utils/roles";

export default function VolunteerRoute({ children }) {
  const { user } = useUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = normalizeUserRole(user.role);

  if (role !== USER_ROLES.VOLUNTEER && role !== USER_ROLES.CONTENT_CONTRIBUTOR) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
