import { useContext } from "react";
import {
  AuthContext,
  type AuthContextType,
} from "../contexts/AuthContext";
import type { User } from "../config/types";

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const useUser = (): User | null => {
  const { user } = useAuth();
  return user;
};

export const useRequireAuth = (): {
  user: User;
  userId: string;
  isAdmin: boolean;
} => {
  const { user, userId, isAuthenticated, isAdmin } = useAuth();

  if (!isAuthenticated || !user || !userId) {
    throw new Error("User must be authenticated");
  }

  return { user, userId, isAdmin };
};

export const useRequireAdmin = (): {
  user: User;
  userId: string;
} => {
  const { user, userId, isAdmin } = useAuth();

  if (!isAdmin || !user || !userId) {
    throw new Error("User must be an admin");
  }

  return { user, userId };
};
