import type { Question, AnswerRecord } from "../../config/types";

/**
 * Quiz state management types and reducer
 */

export interface QuizState {
  selectedOption: number | null;
  answers: AnswerRecord[];
  lastAnsweredIds: Set<number>;
  quizCompleted: boolean;
  hasSubmitted: boolean;
  showCorrectAnswer: boolean;
  currentQuestion: Question | null;
  videoPosition: number;
  timeRemaining: number;
  lastKnownState: {
    position: number;
    timestamp: number;
    isPlaying: boolean;
  } | null;
  initialSyncDone: boolean;
  previousPosition: number;
}

export type QuizAction =
  | { type: "SET_SELECTED_OPTION"; payload: number | null }
  | { type: "SET_ANSWERS"; payload: AnswerRecord[] }
  | { type: "ADD_ANSWER"; payload: AnswerRecord }
  | { type: "UPDATE_ANSWER"; payload: AnswerRecord }
  | { type: "SET_QUIZ_COMPLETED"; payload: boolean }
  | { type: "SET_HAS_SUBMITTED"; payload: boolean }
  | { type: "SET_SHOW_CORRECT_ANSWER"; payload: boolean }
  | { type: "SET_CURRENT_QUESTION"; payload: Question | null }
  | { type: "SET_VIDEO_POSITION"; payload: number }
  | { type: "SET_TIME_REMAINING"; payload: number }
  | {
      type: "SET_LAST_KNOWN_STATE";
      payload: QuizState["lastKnownState"];
    }
  | { type: "SET_INITIAL_SYNC_DONE"; payload: boolean }
  | { type: "SET_PREVIOUS_POSITION"; payload: number }
  | { type: "RESET_QUIZ_STATE" };

export const initialQuizState: QuizState = {
  selectedOption: null,
  answers: [],
  lastAnsweredIds: new Set(),
  quizCompleted: false,
  hasSubmitted: false,
  showCorrectAnswer: false,
  currentQuestion: null,
  videoPosition: 0,
  timeRemaining: 0,
  lastKnownState: null,
  initialSyncDone: false,
  previousPosition: 0,
};

export function quizReducer(
  state: QuizState,
  action: QuizAction,
): QuizState {
  switch (action.type) {
    case "SET_SELECTED_OPTION":
      return { ...state, selectedOption: action.payload };
    case "SET_ANSWERS":
      return { ...state, answers: action.payload };
    case "ADD_ANSWER": {
      const newAnswers = [...state.answers, action.payload];
      const newLastAnsweredIds = new Set(state.lastAnsweredIds);
      newLastAnsweredIds.add(action.payload.question_id);
      return {
        ...state,
        answers: newAnswers,
        lastAnsweredIds: newLastAnsweredIds,
      };
    }
    case "UPDATE_ANSWER": {
      const newAnswers = state.answers.map((answer) =>
        answer.question_id === action.payload.question_id
          ? action.payload
          : answer,
      );
      const newLastAnsweredIds = new Set(state.lastAnsweredIds);
      newLastAnsweredIds.add(action.payload.question_id);
      return {
        ...state,
        answers: newAnswers,
        lastAnsweredIds: newLastAnsweredIds,
      };
    }
    case "SET_QUIZ_COMPLETED":
      return { ...state, quizCompleted: action.payload };
    case "SET_HAS_SUBMITTED":
      return { ...state, hasSubmitted: action.payload };
    case "SET_SHOW_CORRECT_ANSWER":
      return { ...state, showCorrectAnswer: action.payload };
    case "SET_CURRENT_QUESTION":
      return { ...state, currentQuestion: action.payload };
    case "SET_VIDEO_POSITION":
      return { ...state, videoPosition: action.payload };
    case "SET_TIME_REMAINING":
      return { ...state, timeRemaining: action.payload };
    case "SET_LAST_KNOWN_STATE":
      return { ...state, lastKnownState: action.payload };
    case "SET_INITIAL_SYNC_DONE":
      return { ...state, initialSyncDone: action.payload };
    case "SET_PREVIOUS_POSITION":
      return { ...state, previousPosition: action.payload };
    case "RESET_QUIZ_STATE":
      return {
        ...state,
        selectedOption: null,
        currentQuestion: null,
        hasSubmitted: false,
        showCorrectAnswer: false,
      };
    default:
      return state;
  }
}

/**
 * Helper function to determine button styles based on state
 */
export interface ButtonStyles {
  buttonClass: string;
  letterBgClass: string;
  letterTextClass: string;
}

export function getAnswerButtonStyles(
  showResult: boolean,
  isCorrect: boolean,
  isSelected: boolean,
): ButtonStyles {
  if (showResult) {
    if (isCorrect) {
      return {
        buttonClass:
          "bg-green-50 shadow-xl border-2 border-green-500",
        letterBgClass: "bg-green-500",
        letterTextClass: "text-white",
      };
    } else if (isSelected) {
      return {
        buttonClass:
          "bg-red-50 shadow-xl border-2 border-red-500 opacity-60",
        letterBgClass: "bg-red-500",
        letterTextClass: "text-white",
      };
    } else {
      return {
        buttonClass:
          "bg-white shadow-md border-2 border-gray-200 opacity-40",
        letterBgClass: "bg-gray-200",
        letterTextClass: "text-gray-500",
      };
    }
  } else if (isSelected) {
    return {
      buttonClass:
        "bg-white shadow-2xl scale-105 border-2 border-gray-900",
      letterBgClass: "bg-gray-900",
      letterTextClass: "text-white",
    };
  } else {
    return {
      buttonClass:
        "bg-white shadow-md hover:shadow-xl border-2 border-gray-200 hover:border-gray-300",
      letterBgClass: "bg-gray-100",
      letterTextClass: "text-gray-700",
    };
  }
}
