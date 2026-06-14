/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_USER_ROLE, normalizeUserRole } from "../utils/roles";

const UserContext = createContext(null);

function normalizeUser(user) {
  if (!user) return null;

  const userId = user.participantId || user.userId || user.id || user.username;

  return {
    ...user,
    participantId: user.participantId || userId,
    username: user.username || user.participantId || "",
    role: normalizeUserRole(user.role || DEFAULT_USER_ROLE),
  };
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("burushaski_user");
    if (savedUser) {
      try {
        return normalizeUser(JSON.parse(savedUser));
      } catch (err) {
        console.error("Failed to parse saved user:", err);
        localStorage.removeItem("burushaski_user");
      }
    }

    return null;
  });
  const [loading] = useState(false);

  // Save user whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem("burushaski_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("burushaski_user");
    }
  }, [user]);

  const updateUser = (nextUser) => {
    setUser(normalizeUser(nextUser));
  };

  return (
    <UserContext.Provider value={{ user, setUser: updateUser, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
