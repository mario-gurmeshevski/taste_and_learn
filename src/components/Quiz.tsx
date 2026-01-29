import React, {
  useState,
  useReducer,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import supabase from "../lib/supabase";
import { sanitizeText, sanitizeTextArray } from "../lib/sanitize";
import { useAuth } from "../contexts/AuthContext";
import { useAbortController } from "../hooks/useAbortController";
import { useBroadcast } from "../hooks/useBroadcast";
import type {
  Question,
  AnswerRecord,
} from "../config/types";
import {
  RECENT_UPDATE_THRESHOLD,
  QUESTION_CLEAR_DELAY,
  MS_TO_SECONDS,
  MAX_TIME_ELAPSED_CAP,
  JUMP_DETECTION_THRESHOLD,
  DB_TABLES,
  ROUTES,
  DB_FIELDS,
  SORT_ORDER,
} from "../config/constants";
import {
  initialQuizState,
  quizReducer,
} from "./quiz/QuizState";
import QuizLoading from "./quiz/QuizLoading";
import QuizError from "./quiz/QuizError";
import QuizComplete from "./quiz/QuizComplete";
import QuizWaiting from "./quiz/QuizWaiting";
import QuizQuestion from "./quiz/QuizQuestion";

const Quiz: React.FC = () => {
  const navigate = useNavigate();
  const { safeTimeout, safeInterval } = useAbortController();
  const { broadcastState: globalBroadcastState } = useBroadcast();
  const { userId, user, checkingAuth, isAuthenticated } = useAuth();

  const [state, dispatch] = useReducer(quizReducer, initialQuizState);

  const [userName, setUserName] = useState<string>("");
  const [userDiscriminator, setUserDiscriminator] = useState<string>("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const lastKnownStateRef = useRef<{
    position: number;
    timestamp: number;
    isPlaying: boolean;
  } | null>(null);

  const handleAutoSubmit = useCallback((question: Question) => {
    const newAnswer: AnswerRecord = {
      question_id: question.id,
      selected_option: -1,
      is_correct: false,
      score: 0,
    };

    dispatch({
      type: "ADD_ANSWER",
      payload: newAnswer,
    });
    dispatch({ type: "SET_CURRENT_QUESTION", payload: null });
    dispatch({ type: "SET_SELECTED_OPTION", payload: null });
  }, []);

  useEffect(() => {
    // Redirect if not authenticated
    if (checkingAuth) {
      return;
    }

    if (!isAuthenticated || !userId || !user) {
      navigate(ROUTES.LOGIN);
      return;
    }

    // Set user data from auth context
    setUserName(sanitizeText(user.name));
    setUserDiscriminator(sanitizeText(user.discriminator));

    const loadQuizData = async () => {
      try {
        const { data: questionsData, error: questionsError } =
          await supabase
            .from(DB_TABLES.QUESTIONS)
            .select("*")
            .order(DB_FIELDS.START_TIMESTAMP, {
              ascending: SORT_ORDER.ASCENDING,
            });

        if (questionsError) throw questionsError;

        if (questionsData && questionsData.length > 0) {
          const formattedQuestions = questionsData.map((q) => ({
            id: q.id,
            question_text: sanitizeText(q.question_text),
            options: sanitizeTextArray(
              Array.isArray(q.options) ? q.options : JSON.parse(q.options),
            ),
            correct_answer_index: q.correct_answer_index,
            start_timestamp: q.start_timestamp,
            end_timestamp: q.end_timestamp,
          })) as Question[];
          setQuestions(formattedQuestions);

          const { data: sessionData, error: sessionError } =
            await supabase
              .from(DB_TABLES.QUIZ_SESSIONS)
              .insert({
                [DB_FIELDS.USER_ID]: userId,
                started_at: new Date().toISOString(),
                questions_count: formattedQuestions.length,
              })
              .select()
              .maybeSingle();

          if (sessionError) throw sessionError;

          const sessionQuestions = formattedQuestions.map((q) => ({
            session_id: sessionData.id,
            question_id: q.id,
          }));

          const { error: linkError } = await supabase
            .from(DB_TABLES.QUIZ_SESSION_QUESTIONS)
            .insert(sessionQuestions);

          if (linkError) throw linkError;

          setSessionId(sessionData.id);
        } else {
          setError("No questions available");
          toast.error("No questions available", { icon: "📭" });
        }
      } catch (err) {
        console.error("Failed to load quiz data:", err);
        setError("Failed to load quiz. Please try again later.");
        toast.error("Failed to load quiz. Please try again later.", {
          icon: "❌",
          duration: 5000,
        });
      } finally {
        setLoading(false);
      }
    };

    loadQuizData();
  }, [checkingAuth, isAuthenticated, userId, user, navigate]);

  useEffect(() => {
    if (globalBroadcastState) {
      const newTimestamp = new Date(
        globalBroadcastState.updated_at,
      ).getTime();
      const newState = {
        position: globalBroadcastState.current_position,
        timestamp: newTimestamp,
        isPlaying: globalBroadcastState.is_playing,
      };

      const positionDiff = Math.abs(
        newState.position -
          (lastKnownStateRef.current?.position ?? 0),
      );

      const currentTime = Date.now();
      const isRecentUpdate =
        currentTime - newTimestamp < RECENT_UPDATE_THRESHOLD;

      if (
        !lastKnownStateRef.current ||
        positionDiff > 0.5 ||
        isRecentUpdate
      ) {
        dispatch({
          type: "SET_LAST_KNOWN_STATE",
          payload: newState,
        });
        lastKnownStateRef.current = newState;
      } else {
        lastKnownStateRef.current = newState;
      }
    }
  }, [globalBroadcastState]);

  useEffect(() => {
    if (!state.lastKnownState || state.quizCompleted) return;

    const animationFrameRef = { current: null as number | null };
    let isRunning = true;

    const updateLocalTime = () => {
      if (!isRunning || !lastKnownStateRef.current) return;

      const now = Date.now();
      const timeElapsed =
        (now - lastKnownStateRef.current.timestamp) / MS_TO_SECONDS;

      const safeTimeElapsed = Math.max(
        0,
        Math.min(timeElapsed, MAX_TIME_ELAPSED_CAP),
      );

      const expectedPosition = lastKnownStateRef.current.isPlaying
        ? lastKnownStateRef.current.position + safeTimeElapsed
        : lastKnownStateRef.current.position;

      dispatch({
        type: "SET_VIDEO_POSITION",
        payload: Math.max(0, expectedPosition),
      });

      animationFrameRef.current = requestAnimationFrame(updateLocalTime);
    };

    animationFrameRef.current = requestAnimationFrame(updateLocalTime);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      isRunning = false;
    };
  }, [state.lastKnownState, state.quizCompleted]);

  useEffect(() => {
    if (questions.length === 0 || state.quizCompleted) return;

    const positionDelta = state.videoPosition - state.previousPosition;

    if (
      state.initialSyncDone &&
      positionDelta > JUMP_DETECTION_THRESHOLD
    ) {
      const missedQuestions = questions.filter(
        (q: Question) =>
          q.start_timestamp >= state.previousPosition &&
          q.end_timestamp <= state.videoPosition &&
          !state.lastAnsweredIds.has(q.id),
      );

      if (missedQuestions.length > 0) {
        missedQuestions.forEach((question: Question) => {
          handleAutoSubmit(question);
        });
      }
    }

    if (!state.initialSyncDone && state.videoPosition > 0) {
      dispatch({ type: "SET_INITIAL_SYNC_DONE", payload: true });
    }

    dispatch({
      type: "SET_PREVIOUS_POSITION",
      payload: state.videoPosition,
    });

    const activeQuestion = questions.find(
      (q: Question) =>
        state.videoPosition >= q.start_timestamp &&
        state.videoPosition <= q.end_timestamp,
    );

    if (activeQuestion) {
      if (state.currentQuestion?.id !== activeQuestion.id) {
        if (!state.lastAnsweredIds.has(activeQuestion.id)) {
          dispatch({
            type: "SET_CURRENT_QUESTION",
            payload: activeQuestion,
          });
          dispatch({ type: "SET_SELECTED_OPTION", payload: null });
          dispatch({ type: "SET_HAS_SUBMITTED", payload: false });
          dispatch({ type: "SET_SHOW_CORRECT_ANSWER", payload: false });
        }
      }
    } else {
      if (
        state.currentQuestion &&
        state.videoPosition > state.currentQuestion.end_timestamp
      ) {
        if (!state.lastAnsweredIds.has(state.currentQuestion.id)) {
          handleAutoSubmit(state.currentQuestion);
        } else if (state.hasSubmitted && !state.showCorrectAnswer) {
          dispatch({ type: "SET_SHOW_CORRECT_ANSWER", payload: true });
          safeTimeout(() => {
            dispatch({ type: "RESET_QUIZ_STATE" });
          }, QUESTION_CLEAR_DELAY);
          return;
        }
      }
      if (!state.showCorrectAnswer) {
        dispatch({ type: "SET_CURRENT_QUESTION", payload: null });
      }
    }
  }, [
    state.videoPosition,
    state.previousPosition,
    state.initialSyncDone,
    state.currentQuestion,
    state.lastAnsweredIds,
    state.hasSubmitted,
    state.showCorrectAnswer,
    state.quizCompleted,
    questions,
    handleAutoSubmit,
    safeTimeout,
  ]);

  const saveQuizResults = useCallback(
    async (allAnswers: AnswerRecord[]) => {
      if (!userId || !sessionId) return;

      try {
        const answersWithUserId = allAnswers.map((answer) => ({
          ...answer,
          user_id: userId,
        }));

        const { error: answersError } = await supabase
          .from(DB_TABLES.ANSWERS)
          .insert(answersWithUserId);

        if (answersError) throw answersError;

        const totalScore = allAnswers.reduce(
          (sum, answer) => sum + answer.score,
          0,
        );

        const { error: sessionError } = await supabase
          .from(DB_TABLES.QUIZ_SESSIONS)
          .update({
            [DB_FIELDS.COMPLETED_AT]: new Date().toISOString(),
            total_score: totalScore,
          })
          .eq(DB_FIELDS.ID, sessionId);

        if (sessionError) throw sessionError;
      } catch (err) {
        console.error("Error saving quiz results:", err);
        toast.error("Failed to save quiz results. Please try again.", {
          icon: "💾",
          duration: 5000,
        });
      }
    },
    [userId, sessionId],
  );

  useEffect(() => {
    if (
      questions.length > 0 &&
      state.lastAnsweredIds.size === questions.length &&
      !state.quizCompleted
    ) {
      dispatch({ type: "SET_QUIZ_COMPLETED", payload: true });
      saveQuizResults(state.answers);
    }
  }, [state.answers, state.lastAnsweredIds, state.quizCompleted, questions.length, saveQuizResults]);

  useEffect(() => {
    if (!state.currentQuestion) {
      dispatch({ type: "SET_TIME_REMAINING", payload: 0 });
      return;
    }

    const remaining = Math.max(
      0,
      state.currentQuestion.end_timestamp - state.videoPosition,
    );
    dispatch({ type: "SET_TIME_REMAINING", payload: remaining });

    const cleanupInterval = safeInterval(() => {
      dispatch({
        type: "SET_TIME_REMAINING",
        payload: Math.max(0, state.timeRemaining - 1),
      });
    }, 1000);

    return cleanupInterval;
  }, [state.currentQuestion, state.videoPosition, state.timeRemaining, safeInterval]);

  const handleOptionSelect = useCallback((optionIndex: number) => {
    dispatch({
      type: "SET_SELECTED_OPTION",
      payload: optionIndex,
    });
  }, []);

  const handleSubmitAnswer = useCallback(() => {
    if (!state.currentQuestion || state.selectedOption === null) return;

    const newAnswer: AnswerRecord = {
      question_id: state.currentQuestion.id,
      selected_option: state.selectedOption,
      is_correct:
        state.selectedOption === state.currentQuestion.correct_answer_index,
      score:
        state.selectedOption === state.currentQuestion.correct_answer_index
          ? 1
          : 0,
    };

    dispatch({
      type: "ADD_ANSWER",
      payload: newAnswer,
    });
    dispatch({ type: "SET_HAS_SUBMITTED", payload: true });
  }, [state.currentQuestion, state.selectedOption]);

  const nextQuestion = useMemo(() => {
    return questions.find(
      (q: Question) =>
        !state.lastAnsweredIds.has(q.id) &&
        q.start_timestamp > state.videoPosition,
    );
  }, [questions, state.lastAnsweredIds, state.videoPosition]);

  const totalScore = useMemo(() => {
    return state.answers.reduce((sum, answer) => sum + answer.score, 0);
  }, [state.answers]);

  if (loading) {
    return <QuizLoading />;
  }

  if (error) {
    return <QuizError error={error} />;
  }

  if (state.quizCompleted) {
    return (
      <QuizComplete
        totalScore={totalScore}
        questionsCount={questions.length}
        userName={userName}
        userDiscriminator={userDiscriminator}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-4 py-12">
      <div className="max-w-3xl mx-auto">
        {!state.currentQuestion && (
          <QuizWaiting
            answeredCount={state.lastAnsweredIds.size}
            questionsCount={questions.length}
            videoPosition={state.videoPosition}
            nextQuestion={nextQuestion}
            lastKnownState={state.lastKnownState}
          />
        )}

        <AnimatePresence mode="wait">
          {state.currentQuestion && (
            <QuizQuestion
              currentQuestion={state.currentQuestion}
              selectedOption={state.selectedOption}
              hasSubmitted={state.hasSubmitted}
              showCorrectAnswer={state.showCorrectAnswer}
              timeRemaining={state.timeRemaining}
              onOptionSelect={handleOptionSelect}
              onSubmitAnswer={handleSubmitAnswer}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Quiz;
