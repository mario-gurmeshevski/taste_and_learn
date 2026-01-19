import React, { useState, useEffect } from "react";
import supabase from "../lib/supabase";

interface Question {
  id: number;
  question_text: string;
  options: string[];
  correct_answer_index: number;
}

interface AnswerRecord {
  question_id: number;
  selected_option: number;
  is_correct: boolean;
  score: number;
}

const Quiz: React.FC = () => {
  const [userName, setUserName] = useState("");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(
    null,
  );
  const [timeLeft, setTimeLeft] = useState(30);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);

  const currentQuestion = questions[currentQuestionIndex];

  // Fetch questions on mount
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const { data, error } = await supabase
          .from("questions")
          .select("*")
          .order("id", { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          const formattedQuestions = data.map((q: any) => ({
            id: q.id,
            question_text: q.question_text,
            options: Array.isArray(q.options)
              ? q.options
              : JSON.parse(q.options),
            correct_answer_index: q.correct_answer_index,
          }));

          setQuestions(formattedQuestions);
        } else {
          setError("No questions available");
        }
      } catch (err) {
        console.error("Error fetching questions:", err);
        setError("Failed to load questions. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  // Timer
  useEffect(() => {
    if (
      !quizStarted ||
      quizCompleted ||
      currentQuestionIndex >= questions.length
    )
      return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleNextQuestion();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentQuestionIndex, quizCompleted, quizStarted, questions]);

  const handleSubmitName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;

    try {
      // Sign in anonymously
      const { data: authData, error: authError } =
        await supabase.auth.signInAnonymously();

      if (authError) throw authError;

      const newUserId = authData.user?.id;

      // Insert user profile
      const { error: insertError } = await supabase
        .from("users")
        .upsert({
          id: newUserId,
          name: userName,
          role: "user",
        });

      if (insertError) throw insertError;

      setUserId(newUserId!);
      setQuizStarted(true);
    } catch (error) {
      console.error("Error handling user:", error);
      alert("Error processing user. Please try again.");
    }
  };

  const handleOptionSelect = (optionIndex: number) => {
    if (selectedOption === null) {
      setSelectedOption(optionIndex);
    }
  };

  const handleNextQuestion = async () => {
    const newAnswer: AnswerRecord = {
      question_id: currentQuestion.id,
      selected_option: selectedOption !== null ? selectedOption : -1,
      is_correct:
        selectedOption !== null &&
        selectedOption === currentQuestion.correct_answer_index,
      score:
        selectedOption !== null &&
        selectedOption === currentQuestion.correct_answer_index
          ? 1
          : 0,
    };

    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);
    setSelectedOption(null);
    setTimeLeft(30);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setQuizCompleted(true);
      await saveAnswersToSupabase(updatedAnswers);
    }
  };

  const saveAnswersToSupabase = async (
    allAnswers: AnswerRecord[],
  ) => {
    if (!userId) return;

    try {
      const answersWithUserId = allAnswers.map((answer) => ({
        ...answer,
        user_id: userId,
      }));

      const { error } = await supabase
        .from("answers")
        .insert(answersWithUserId);

      if (error) throw error;
      console.log("Answers saved successfully");
    } catch (error) {
      console.error("Error saving answers:", error);
    }
  };

  if (!quizStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <div className="max-w-md w-full bg-white border border-neutral-200 p-12">
          <h1 className="text-3xl font-light text-neutral-900 mb-8 tracking-tight">
            Enter Your Name
          </h1>
          <form onSubmit={handleSubmitName}>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-3 border border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-900 mb-6 text-sm"
              required
            />
            <button
              type="submit"
              className="w-full bg-neutral-900 text-white py-3 text-sm font-medium hover:bg-neutral-800 transition-colors duration-200"
            >
              Start Quiz
            </button>
          </form>
        </div>
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
        <div className="max-w-md w-full bg-white border border-neutral-200 p-12 text-center">
          <h1 className="text-3xl font-light text-neutral-900 mb-8 tracking-tight">
            Quiz Complete!
          </h1>
          <div className="mb-8">
            <div className="text-6xl font-light text-neutral-900 mb-2">
              {totalScore}
            </div>
            <div className="text-sm text-neutral-600">
              of {questions.length} correct
            </div>
          </div>
          <p className="text-neutral-700 mb-8">
            Well done, <span className="font-medium">{userName}</span>
            !
          </p>
          <a
            href="/"
            className="inline-block bg-neutral-900 text-white px-8 py-3 text-sm font-medium hover:bg-neutral-800 transition-colors duration-200"
          >
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <div className="max-w-md w-full bg-white border border-neutral-200 p-12 text-center">
          <h1 className="text-3xl font-light text-neutral-900 mb-8 tracking-tight">
            Loading Quiz...
          </h1>
          <div className="flex justify-center">
            <div className="w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <div className="max-w-md w-full bg-white border border-neutral-200 p-12 text-center">
          <h1 className="text-3xl font-light text-neutral-900 mb-8 tracking-tight">
            Error Loading Quiz
          </h1>
          <p className="text-neutral-700 mb-8">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-neutral-900 text-white px-8 py-3 text-sm font-medium hover:bg-neutral-800 transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white border border-neutral-200">
          <div className="border-b border-neutral-200 p-6 flex justify-between items-center">
            <h1 className="text-xl font-medium text-neutral-900">
              Quiz
            </h1>
            <div className="flex items-center gap-2 text-neutral-900">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm font-medium">{timeLeft}s</span>
            </div>
          </div>

          <div className="p-8">
            <div className="mb-6">
              <span className="text-xs uppercase tracking-wider text-neutral-500">
                Question {currentQuestionIndex + 1} of{" "}
                {questions.length}
              </span>
            </div>

            <h2 className="text-2xl font-light text-neutral-900 mb-10 leading-relaxed">
              {currentQuestion.question_text}
            </h2>

            <div className="space-y-3 mb-10">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleOptionSelect(index)}
                  disabled={selectedOption !== null}
                  className={`w-full text-left p-4 border transition-all duration-150 ${
                    selectedOption === index
                      ? "border-neutral-900 bg-neutral-50"
                      : "border-neutral-200 hover:border-neutral-400"
                  } ${
                    selectedOption !== null &&
                    selectedOption !== index
                      ? "opacity-50"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 flex items-center justify-center border border-neutral-300 text-xs text-neutral-600">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-sm text-neutral-900">
                      {option}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {selectedOption !== null && (
              <div className="flex justify-end">
                <button
                  onClick={handleNextQuestion}
                  className="bg-neutral-900 text-white px-8 py-3 text-sm font-medium hover:bg-neutral-800 transition-colors duration-200"
                >
                  {currentQuestionIndex < questions.length - 1
                    ? "Next Question"
                    : "Finish Quiz"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Quiz;
