import { useContext } from "react";
import { type AuthContextType } from "../config/types";
import { AuthContext } from "../contexts/auth/AuthProvider";

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
