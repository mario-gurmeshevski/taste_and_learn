import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FaCheck, FaTimes, FaPlay, FaPause } from "react-icons/fa";
import { RealtimeChannel } from "@supabase/supabase-js";
import supabase from "../lib/supabase";
import type {
  BroadcastState,
  Question,
  AnswerRecord,
} from "../config/types";
import {
  POLLING_INTERVAL,
  RECENT_UPDATE_THRESHOLD,
  SUBSCRIPTION_TIMEOUT,
  QUESTION_CLEAR_DELAY,
  MS_TO_SECONDS,
  MAX_TIME_ELAPSED_CAP,
  JUMP_DETECTION_THRESHOLD,
  BROADCAST_CHANNEL_NAME,
  DB_TABLES,
  ROUTES,
  DB_FIELDS,
  SORT_ORDER,
  ANSWER_LABELS,
} from "../config/constants";

const Quiz: React.FC = () => {
  const navigate = useNavigate();
  const [selectedOption, setSelectedOption] = useState<number | null>(
    null,
  );
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userDiscriminator, setUserDiscriminator] = useState<string>("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Video sync state
  const [broadcastState, setBroadcastState] =
    useState<BroadcastState | null>(null);
  const [currentQuestion, setCurrentQuestion] =
    useState<Question | null>(null);
  const [videoPosition, setVideoPosition] = useState(0);
  const lastAnsweredRef = useRef<Set<number>>(new Set());
  const answersRef = useRef<AnswerRecord[]>([]);
  const previousPositionRef = useRef<number>(0);
  const initialSyncDoneRef = useRef<boolean>(false); // Track if initial sync is complete
  const hasSuccessfullySubscribedRef = useRef<boolean>(false); // Track subscription success for timeout guard

  // Local time tracking state
  const [lastKnownState, setLastKnownState] = useState<{
    position: number;
    timestamp: number;
    isPlaying: boolean;
  } | null>(null);

  const lastKnownStateRef = useRef<{
    position: number;
    timestamp: number;
    isPlaying: boolean;
  } | null>(null);

  // Keep answersRef in sync
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    const initializeQuiz = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          navigate(ROUTES.LOGIN);
          return;
        }

        // Ensure Realtime authentication is set
        if (session.access_token) {
          supabase.realtime.setAuth(session.access_token);
        }

        const currentUserId = session.user.id;
        setUserId(currentUserId);

        const { data: userData, error: userError } = await supabase
          .from(DB_TABLES.USERS)
          .select("name, discriminator")
          .eq(DB_FIELDS.ID, currentUserId)
          .single();

        if (userError) throw userError;
        setUserName(userData.name);
        setUserDiscriminator(userData.discriminator);

        const { data: questionsData, error: questionsError } =
          await supabase
            .from(DB_TABLES.QUESTIONS)
            .select("*")
            .order(DB_FIELDS.START_TIMESTAMP, { ascending: SORT_ORDER.ASCENDING });

        if (questionsError) throw questionsError;

        if (questionsData && questionsData.length > 0) {
          const formattedQuestions = questionsData.map((q) => ({
            id: q.id,
            question_text: q.question_text,
            options: Array.isArray(q.options)
              ? q.options
              : JSON.parse(q.options),
            correct_answer_index: q.correct_answer_index,
            start_timestamp: q.start_timestamp,
            end_timestamp: q.end_timestamp,
          })) as Question[];
          setQuestions(formattedQuestions);

          const { data: sessionData, error: sessionError } =
            await supabase
              .from(DB_TABLES.QUIZ_SESSIONS)
              .insert({
                [DB_FIELDS.USER_ID]: currentUserId,
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
        }
      } catch (err) {
        console.error("Error initializing quiz:", err);
        setError("Failed to load quiz. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    initializeQuiz();
  }, [navigate]);

  // Subscribe to broadcast state
  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let subscriptionTimer: ReturnType<typeof setTimeout> | null =
      null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (pollInterval) return; // Already polling

      pollInterval = setInterval(async () => {
        try {
          const { data } = await supabase
            .from(DB_TABLES.PUBLIC_BROADCAST_STATE)
            .select("*")
            .maybeSingle();

          if (data) {
            setBroadcastState(data);
            setVideoPosition(data.current_position);
            setLastKnownState({
              position: data.current_position,
              timestamp: new Date(data.updated_at).getTime(),
              isPlaying: data.is_playing,
            });
          }
        } catch (error) {
          console.error("Error polling:", error);
        }
      }, POLLING_INTERVAL);
    };

    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const initSubscription = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        // Fetch initial state
        const { data } = await supabase
          .from(DB_TABLES.PUBLIC_BROADCAST_STATE)
          .select("*")
          .maybeSingle();

        if (data) {
          setBroadcastState(data);
          setVideoPosition(data.current_position);
          setLastKnownState({
            position: data.current_position,
            timestamp: new Date(data.updated_at).getTime(),
            isPlaying: data.is_playing,
          });
        }

        // START: When subscription starts, start a 10-second timer
        subscriptionTimer = setTimeout(() => {
          // Only start polling if we haven't successfully subscribed yet
          if (!hasSuccessfullySubscribedRef.current) {
            startPolling();
          }
        }, SUBSCRIPTION_TIMEOUT);

        // Subscribe to broadcast
        channel = supabase
          .channel(BROADCAST_CHANNEL_NAME)
          .on(
            "broadcast",
            { event: "broadcast-state-update" },
            (payload) => {
              const newState = payload.payload as BroadcastState;
              setBroadcastState(newState);
              setLastKnownState({
                position: newState.current_position,
                timestamp: new Date(newState.updated_at).getTime(),
                isPlaying: newState.is_playing,
              });
            },
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              // STOP: Subscription succeeded - stop the timer and polling
              hasSuccessfullySubscribedRef.current = true; // Set guard to prevent timeout from triggering
              if (subscriptionTimer) {
                clearTimeout(subscriptionTimer);
                subscriptionTimer = null;
              }
              stopPolling();
            } else if (
              status === "CHANNEL_ERROR" ||
              status === "TIMED_OUT"
            ) {
              // Subscription failed - start polling immediately
              startPolling();
            }
          });
      } catch (error) {
        console.error("Error:", error);
        startPolling();
      }
    };

    initSubscription();

    // Cleanup
    return () => {
      if (subscriptionTimer) clearTimeout(subscriptionTimer);
      if (pollInterval) clearInterval(pollInterval);
      if (channel) supabase.removeChannel(channel);
      hasSuccessfullySubscribedRef.current = false; // Reset for potential remount
    };
  }, []);

  // Update lastKnownState when broadcast state changes
  useEffect(() => {
    if (broadcastState) {
      const newTimestamp = new Date(
        broadcastState.updated_at,
      ).getTime();
      const newState = {
        position: broadcastState.current_position,
        timestamp: newTimestamp,
        isPlaying: broadcastState.is_playing,
      };

      // Check if position changed significantly
      const positionDiff = Math.abs(
        newState.position -
          (lastKnownStateRef.current?.position ?? 0),
      );

      // Always update if this is the first state or position changed
      // Use timestamp to detect fresh updates (within last 5 seconds = recent admin action)
      const currentTime = Date.now();
      const isRecentUpdate =
        currentTime - newTimestamp < RECENT_UPDATE_THRESHOLD; // 5 seconds

      if (
        !lastKnownStateRef.current ||
        positionDiff > 0.5 ||
        isRecentUpdate
      ) {
        setLastKnownState(newState);
        lastKnownStateRef.current = newState;
      } else {
        // Still update the ref but don't trigger state change
        lastKnownStateRef.current = newState;
      }
    }
  }, [broadcastState]);

  // Local time interpolation using requestAnimationFrame
  useEffect(() => {
    if (!lastKnownState || quizCompleted) return;

    let animationFrameId: number;
    let isRunning = true;

    const updateLocalTime = () => {
      if (!isRunning || !lastKnownStateRef.current) return;

      const now = Date.now();
      const timeElapsed =
        (now - lastKnownStateRef.current.timestamp) / MS_TO_SECONDS;

      // Sanity check: if timeElapsed is negative or too large, use the base position
      // This can happen if there's a clock sync issue or timestamp parsing problem
      const safeTimeElapsed = Math.max(
        0,
        Math.min(timeElapsed, MAX_TIME_ELAPSED_CAP),
      ); // Cap at MAX_TIME_ELAPSED_CAP seconds

      const expectedPosition = lastKnownStateRef.current.isPlaying
        ? lastKnownStateRef.current.position + safeTimeElapsed
        : lastKnownStateRef.current.position;

      // Don't allow negative positions
      setVideoPosition(Math.max(0, expectedPosition));

      animationFrameId = requestAnimationFrame(updateLocalTime);
    };

    animationFrameId = requestAnimationFrame(updateLocalTime);

    return () => {
      isRunning = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [lastKnownState, quizCompleted]);

  // Update current question based on video position with seek detection
  useEffect(() => {
    if (questions.length === 0 || quizCompleted) return;

    // Detect if video jumped forward (seek occurred)
    // Skip detection on initial sync
    const positionDelta = videoPosition - previousPositionRef.current;

    if (
      initialSyncDoneRef.current &&
      positionDelta > JUMP_DETECTION_THRESHOLD
    ) {
      // Jump of more than JUMP_DETECTION_THRESHOLD seconds detected (after initial sync)
      // Find and auto-submit any missed questions
      const missedQuestions = questions.filter(
        (q) =>
          q.start_timestamp >= previousPositionRef.current &&
          q.end_timestamp <= videoPosition &&
          !lastAnsweredRef.current.has(q.id),
      );

      if (missedQuestions.length > 0) {
        missedQuestions.forEach((question) => {
          handleAutoSubmit(question);
        });
      }
    }

    // Mark initial sync as complete after first position update
    if (!initialSyncDoneRef.current && videoPosition > 0) {
      initialSyncDoneRef.current = true;
    }

    previousPositionRef.current = videoPosition;

    // Find active question at current position
    const activeQuestion = questions.find(
      (q) =>
        videoPosition >= q.start_timestamp &&
        videoPosition <= q.end_timestamp,
    );

    if (activeQuestion) {
      if (currentQuestion?.id !== activeQuestion.id) {
        if (!lastAnsweredRef.current.has(activeQuestion.id)) {
          setCurrentQuestion(activeQuestion);
          setSelectedOption(null);
          setHasSubmitted(false);
          setShowCorrectAnswer(false);
        }
      }
    } else {
      if (
        currentQuestion &&
        videoPosition > currentQuestion.end_timestamp
      ) {
        if (!lastAnsweredRef.current.has(currentQuestion.id)) {
          handleAutoSubmit(currentQuestion);
        } else if (hasSubmitted && !showCorrectAnswer) {
          // Show correct answer before clearing
          setShowCorrectAnswer(true);
          // Clear question after a delay
          setTimeout(() => {
            setCurrentQuestion(null);
            setSelectedOption(null);
            setHasSubmitted(false);
            setShowCorrectAnswer(false);
          }, QUESTION_CLEAR_DELAY);
          return; // Don't clear immediately
        }
      }
      if (!showCorrectAnswer) {
        setCurrentQuestion(null);
      }
    }
  }, [
    videoPosition,
    questions,
    currentQuestion,
    quizCompleted,
    hasSubmitted,
    showCorrectAnswer,
  ]);

  // Check quiz completion
  useEffect(() => {
    if (
      questions.length > 0 &&
      lastAnsweredRef.current.size === questions.length &&
      !quizCompleted
    ) {
      setQuizCompleted(true);
      saveQuizResults(answersRef.current);
    }
  }, [answers, questions.length, quizCompleted]);

  // Update time remaining every second when a question is active
  useEffect(() => {
    if (!currentQuestion) {
      setTimeRemaining(0);
      return;
    }

    // Calculate initial time remaining
    const remaining = Math.max(0, currentQuestion.end_timestamp - videoPosition);
    setTimeRemaining(remaining);

    // Update every second
    const interval = setInterval(() => {
      const newRemaining = Math.max(0, currentQuestion.end_timestamp - videoPosition);
      setTimeRemaining(newRemaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentQuestion?.id, currentQuestion?.end_timestamp, videoPosition]);

  const handleAutoSubmit = (question: Question) => {
    const newAnswer: AnswerRecord = {
      question_id: question.id,
      selected_option: -1,
      is_correct: false,
      score: 0,
    };

    setAnswers((prev) => [...prev, newAnswer]);
    lastAnsweredRef.current.add(question.id);
    setCurrentQuestion(null);
    setSelectedOption(null);
  };

  const handleOptionSelect = (optionIndex: number) => {
    if (currentQuestion && !hasSubmitted) {
      setSelectedOption(optionIndex);
    }
  };

  const handleSubmitAnswer = () => {
    if (!currentQuestion || selectedOption === null || hasSubmitted)
      return;

    const newAnswer: AnswerRecord = {
      question_id: currentQuestion.id,
      selected_option: selectedOption,
      is_correct:
        selectedOption === currentQuestion.correct_answer_index,
      score:
        selectedOption === currentQuestion.correct_answer_index
          ? 1
          : 0,
    };

    setAnswers((prev) => [...prev, newAnswer]);
    lastAnsweredRef.current.add(currentQuestion.id);
    setHasSubmitted(true);
  };

  const saveQuizResults = async (allAnswers: AnswerRecord[]) => {
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
    } catch (error) {
      console.error("Error saving quiz results:", error);
    }
  };

  const getNextQuestion = () => {
    // Find the next unanswered question
    return questions.find(
      (q) =>
        !lastAnsweredRef.current.has(q.id) &&
        q.start_timestamp > videoPosition,
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-md w-full bg-white border border-neutral-200 p-12 text-center"
        >
          <h1 className="text-3xl font-light text-neutral-900 mb-8">
            Loading Quiz...
          </h1>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <motion.div className="max-w-md w-full bg-white border border-neutral-200 p-12 text-center">
          <h1 className="text-3xl font-light text-neutral-900 mb-8">
            Error Loading Quiz
          </h1>
          <p className="text-neutral-700 mb-8">{error}</p>
        </motion.div>
      </div>
    );
  }

  if (quizCompleted) {
    const totalScore = answers.reduce(
      (sum, answer) => sum + answer.score,
      0,
    );

    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white border border-neutral-200 p-12 text-center"
        >
          <h1 className="text-3xl font-light text-neutral-900 mb-8">
            Quiz Complete!
          </h1>
          <div className="text-6xl font-light text-neutral-900 mb-2">
            {totalScore}
          </div>
          <div className="text-sm text-neutral-600 mb-8">
            of {questions.length} correct
          </div>
          <p className="text-neutral-700 mb-8">
            Well done, <span className="font-medium">{userName}#{userDiscriminator}</span>
            !
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-4 py-12">
      <div className="max-w-3xl mx-auto">
        {!currentQuestion && (
          <div className="bg-white border border-neutral-200 p-6 text-center">
            <p className="text-neutral-600">
              Waiting for next question... (
              {lastAnsweredRef.current.size}/{questions.length}
              answered)
            </p>
            <p className="text-sm text-neutral-500 mt-2">
              Video position: {videoPosition.toFixed(1)}s
            </p>
            {(() => {
              const nextQuestion = getNextQuestion();
              if (nextQuestion) {
                const timeUntilNext = Math.max(
                  0,
                  nextQuestion.start_timestamp - videoPosition,
                );
                return (
                  <p className="text-sm text-neutral-600 mt-2 font-medium">
                    Next question in {Math.ceil(timeUntilNext)}s
                  </p>
                );
              } else if (
                lastAnsweredRef.current.size < questions.length
              ) {
                return (
                  <p className="text-sm text-neutral-500 mt-2">
                    All remaining questions passed
                  </p>
                );
              }
              return null;
            })()}
            {lastKnownState && (
              <p className="text-xs text-neutral-400 mt-1">
                Broadcast:
                <span className="inline-flex items-center gap-1">
                  {lastKnownState.isPlaying ? (
                    <>
                      <FaPlay aria-hidden="true" /> Playing
                    </>
                  ) : (
                    <>
                      <FaPause aria-hidden="true" /> Paused
                    </>
                  )}
                </span>
              </p>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          {currentQuestion && (
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-gray-100 border border-gray-300"
            >
              <div className="border-b border-gray-300 p-4 sm:p-6 flex justify-between items-center bg-white">
                <h1 className="text-lg sm:text-xl font-medium text-gray-900">
                  Quiz
                </h1>
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-medium text-gray-700">
                    {Math.ceil(timeRemaining)}s remaining
                  </span>
                </div>
              </div>

              <div className="p-4 sm:p-6 md:p-8">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-gray-900 mb-4 sm:mb-6 md:mb-8 text-center">
                  {currentQuestion.question_text}
                </h2>

                {/* Enhanced 2x2 grid with clean monochrome design */}
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8"
                  role="group"
                  aria-label="Quiz answer options"
                >
                  {currentQuestion.options.map((option, index) => {
                    const isSelected = selectedOption === index;
                    const isCorrect =
                      index === currentQuestion.correct_answer_index;
                    const showResult = showCorrectAnswer;
                    const wasCorrect = isSelected && isCorrect;

                    // Determine button style based on state
                    let buttonClass = "";
                    let letterBgClass = "";
                    let letterTextClass = "";

                    if (showResult) {
                      // Show correct answer mode
                      if (isCorrect) {
                        // Correct answer
                        buttonClass =
                          "bg-green-50 shadow-xl border-2 border-green-500";
                        letterBgClass = "bg-green-500";
                        letterTextClass = "text-white";
                      } else if (isSelected && !wasCorrect) {
                        // Wrong answer selected
                        buttonClass =
                          "bg-red-50 shadow-xl border-2 border-red-500 opacity-60";
                        letterBgClass = "bg-red-500";
                        letterTextClass = "text-white";
                      } else {
                        // Not selected, not correct
                        buttonClass =
                          "bg-white shadow-md border-2 border-gray-200 opacity-40";
                        letterBgClass = "bg-gray-200";
                        letterTextClass = "text-gray-500";
                      }
                    } else if (isSelected) {
                      // Normal selection mode
                      buttonClass =
                        "bg-white shadow-2xl scale-105 border-2 border-gray-900";
                      letterBgClass = "bg-gray-900";
                      letterTextClass = "text-white";
                    } else {
                      // Normal unselected
                      buttonClass =
                        "bg-white shadow-md hover:shadow-xl border-2 border-gray-200 hover:border-gray-300";
                      letterBgClass = "bg-gray-100";
                      letterTextClass = "text-gray-700";
                    }

                    return (
                      <motion.button
                        key={index}
                        onClick={() => handleOptionSelect(index)}
                        whileHover={
                          !hasSubmitted ? { scale: 1.02 } : {}
                        }
                        whileTap={
                          !hasSubmitted ? { scale: 0.98 } : {}
                        }
                        disabled={hasSubmitted}
                        aria-label={`Answer option ${ANSWER_LABELS[index]}: ${option}`}
                        aria-pressed={isSelected}
                        aria-disabled={hasSubmitted}
                        className={`
                          relative h-32 sm:h-40 md:h-44 rounded-2xl font-semibold
                          transition-all duration-200
                          ${hasSubmitted ? "cursor-default" : "cursor-pointer"}
                          ${buttonClass}
                        `}
                      >
                        {/* Letter indicator with rounded square */}
                        <div
                          className={`
                          absolute top-3 sm:top-4 left-3 sm:left-4 w-10 h-10 sm:w-12 sm:h-12 rounded-xl
                          flex items-center justify-center text-xl sm:text-2xl font-black
                          ${letterBgClass} ${letterTextClass}
                        `}
                          aria-hidden="true"
                        >
                          {ANSWER_LABELS[index]}
                        </div>

                        {/* Answer text */}
                        <div className="flex items-center justify-center h-full px-4 sm:px-6 md:px-8 pt-8 sm:pt-10 pb-4 sm:pb-6">
                          <span className="text-base sm:text-lg md:text-xl leading-relaxed text-center text-gray-800">
                            {option}
                          </span>
                        </div>

                        {/* Result indicator */}
                        {showResult && isCorrect && (
                          <div
                            className="absolute top-4 right-4 text-green-500"
                            aria-label="Correct answer"
                          >
                            <FaCheck
                              className="w-8 h-8"
                              aria-hidden="true"
                            />
                          </div>
                        )}
                        {showResult && isSelected && !wasCorrect && (
                          <div
                            className="absolute top-4 right-4 text-red-500"
                            aria-label="Incorrect answer"
                          >
                            <FaTimes
                              className="w-8 h-8"
                              aria-hidden="true"
                            />
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {selectedOption !== null && (
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onClick={handleSubmitAnswer}
                      disabled={hasSubmitted}
                      aria-label="Submit your answer"
                      className={`w-full px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-lg font-bold rounded-lg transition-colors ${
                        hasSubmitted
                          ? "bg-gray-300 text-gray-400 cursor-not-allowed"
                          : "bg-gray-800 text-white hover:bg-gray-900"
                      }`}
                    >
                      Submit
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Quiz;
