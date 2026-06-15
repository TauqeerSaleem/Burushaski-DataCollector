import { Navigate } from "react-router-dom";
import { useUser } from "../context/UserContext";

export default function AuthRedirect() {
  const { user } = useUser();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
}
