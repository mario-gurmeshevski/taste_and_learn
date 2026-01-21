import type { UserRole } from "./constants";

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
 * Minimal user type with just role (used in ProtectedRoute fallback)
 */

export interface BasicUser {
  role: UserRole;
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
 * Quiz session type from the quiz_sessions table
 */

export interface QuizSession {
  id: number;
  user_id: string;
  started_at: string;
  completed_at: string | null;
  total_score: number;
  questions_count: number;
}

/**
 * Quiz session question junction table
 */

export interface QuizSessionQuestion {
  id: number;
  session_id: number;
  question_id: number;
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

/**
 * Plyr instance reference
 * Using 'any' to match Plyr's actual API which has many properties
 */

export interface PlyrRef {
  plyr: any; // Plyr instance with full API (seeking, currentTime, etc.)
}

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

// COMPONENT PROP TYPES

/**
 * Props for Skeleton component
 */
export interface SkeletonProps {
  className?: string;
}

/**
 * Props for ProtectedRoute component
 */
export interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}
