// DEBUGGING

/** Enable/disable console logging for debugging subscription and broadcast */
export const DEBUG_MODE = true;

// TIMING & POLLING INTERVALS (milliseconds)

/** Polling interval for broadcast state fallback */
export const POLLING_INTERVAL = 5000; // 5 seconds

/** Polling interval as safety net when realtime is subscribed */
export const POLLING_INTERVAL_BACKUP = 30000; // 30 seconds

/** Time window to consider a broadcast update as "recent" */
export const RECENT_UPDATE_THRESHOLD = 5000; // 5 seconds

/** Maximum time to wait for Realtime subscription before falling back to polling */
export const SUBSCRIPTION_TIMEOUT = 10000; // 10 seconds

/** How often to check and correct video position drift */
export const VIDEO_SYNC_INTERVAL = 1000; // 1 second

/** How often the admin panel updates the broadcast state table */
export const ADMIN_SYNC_INTERVAL = 30000; // 30 seconds

/** Time to wait before clearing the question overlay after answering */
export const QUESTION_CLEAR_DELAY = 4000; // 4 seconds

// VIDEO SYNCHRONIZATION

/** Maximum allowed time drift before forcing sync */
export const MAX_DRIFT_TOLERANCE = 1.0; // 1 second

/** Minimum position change to consider it a "seek" operation */
export const JUMP_DETECTION_THRESHOLD = 2.0; // 2 seconds

/** Prevents unrealistic time calculations from clock sync issues */
export const MAX_TIME_ELAPSED_CAP = 60; // 60 seconds

/** Number of seconds to skip when using skip controls */
export const SKIP_AMOUNT = 100; // 10 seconds

// DATABASE CONFIGURATION

/** Supabase database table names */
export const DB_TABLES = {
  USERS: "users",
  QUESTIONS: "questions",
  ANSWERS: "answers",
  QUIZ_SESSIONS: "quiz_sessions",
  QUIZ_SESSION_QUESTIONS: "quiz_session_questions",
  PUBLIC_BROADCAST_STATE: "public_broadcast_state",
} as const;

/** Common database field names for type-safe queries */
export const DB_FIELDS = {
  ID: "id",
  USER_ID: "user_id",
  ROLE: "role",
  NAME: "name",
  START_TIMESTAMP: "start_timestamp",
  END_TIMESTAMP: "end_timestamp",
  TOTAL_SCORE: "total_score",
  COMPLETED_AT: "completed_at",
  CREATED_AT: "created_at",
  UPDATED_AT: "updated_at",
  CURRENT_POSITION: "current_position",
  IS_PLAYING: "is_playing",
} as const;

/** Sort order options for database queries */
export const SORT_ORDER = {
  ASCENDING: true,
  DESCENDING: false,
} as const;

// REALTIME & NETWORK

/** Channel name for broadcast state synchronization */
export const BROADCAST_CHANNEL_NAME = "broadcast-sync";

// AUTHENTICATION & AUTHORIZATION

/** User role types - must match the role enum in the database */
export const USER_ROLES = {
  USER: "user",
  ADMIN: "admin",
} as const;

/** Type for user role values */
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

// NAVIGATION & ROUTES

/** Application route paths */
export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  QUIZ: "/quiz",
  ADMIN: "/admin",
  LEADERBOARD: "/leaderboard",
  NOT_FOUND: "/404",
} as const;

// UI & ANIMATION

/** Default damping for spring animations */
export const SPRING_DAMPING = 30;

/** Default stiffness for spring animations */
export const SPRING_STIFFNESS = 350;

// QUIZ GAME LOGIC

/** Answer option labels for multiple choice options */
export const ANSWER_LABELS = ["A", "B", "C", "D"] as const;

// UTILITY & CONVERSION

/** Milliseconds to seconds conversion factor */
export const MS_TO_SECONDS = 1000;

export const MAX_NAME_LENGTH = 50;
export const MAX_QUESTION_LENGTH = 500;
export const MAX_OPTION_LENGTH = 200;
export const MIN_NAME_LENGTH = 1;
export const USERNAME_REGEX = /^[a-zA-Z0-9\s\-_'.]+$/;

/** Maximum time to wait for authentication check before timeout */
export const AUTH_TIMEOUT = 15000; // 15 seconds
