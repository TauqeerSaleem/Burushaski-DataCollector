import { Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { normalizeUserRole, USER_ROLES } from "../utils/roles";

export default function VolunteerRoute({ children }) {
  const { user } = useUser();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (normalizeUserRole(user.role) !== USER_ROLES.VOLUNTEER) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
