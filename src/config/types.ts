import type { UserRole } from "./constants";
import type { APITypes } from "plyr-react";

// DATABASE TYPES

/**
 * User type from the users table
 */

export interface User {
  id: string;
  name: string;
  discriminator: string;
  role: UserRole;
  created_at: string;
}

/**
 * Question type from the questions table
 */

export interface Question {
  id: number;
  question_text: string;
  options: string[];
  correct_answer_index: number;
  start_timestamp: number;
  end_timestamp: number;
  created_at?: string;
}

/**
 * Answer type from the answers table
 */

export interface Answer {
  id: number;
  user_id: string;
  question_id: number;
  selected_option: number;
  is_correct: boolean;
  score: number;
  created_at: string;
}

/**
 * Broadcast state from the public_broadcast_state table
 */

export interface BroadcastState {
  id: number;
  current_position: number;
  is_playing: boolean;
  updated_by?: string;
  updated_at: string;
}

// COMPONENT-SPECIFIC TYPES

/**
 * Answer record used in Quiz component
 */

export interface AnswerRecord {
  question_id: number;
  selected_option: number;
  is_correct: boolean;
  score: number;
}

export type PlyrRef = APITypes;

// LEADERBOARD TYPES

/**
 * User in leaderboard with aggregated stats
 */
export interface LeaderboardUser {
  id: string;
  name: string;
  discriminator: string;
  totalScore: number;
  attemptsCount: number;
  lastAttempt: string | null;
  isCurrentUser?: boolean;
}

/**
 * Props for ProtectedRoute component
 */
export interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

// AUTHENTICATION TYPES

/**
 * Authentication context state
 */
export interface AuthState {
  user: User | null;
  userId: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  checkingAuth: boolean;
  hasValidCachedUser: boolean;
}

/**
 * Authentication context actions
 */
export interface AuthActions {
  signInAnonymously: (userName: string) => Promise<void>;
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

/**
 * Combined authentication context
 */
export type AuthContextType = AuthState & AuthActions;
