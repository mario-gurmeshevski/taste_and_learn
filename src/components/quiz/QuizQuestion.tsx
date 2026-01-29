import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Question } from "../../config/types";
import QuizHeader from "./QuizHeader";
import QuizAnswerButton from "./QuizAnswerButton";

interface QuizQuestionProps {
  currentQuestion: Question;
  selectedOption: number | null;
  hasSubmitted: boolean;
  showCorrectAnswer: boolean;
  timeRemaining: number;
  onOptionSelect: (index: number) => void;
  onSubmitAnswer: () => void;
}

const QuizQuestion: React.FC<QuizQuestionProps> = ({
  currentQuestion,
  selectedOption,
  hasSubmitted,
  showCorrectAnswer,
  timeRemaining,
  onOptionSelect,
  onSubmitAnswer,
}) => {
  return (
    <motion.div
      key={currentQuestion.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-gray-100 border border-gray-300"
    >
      <QuizHeader timeRemaining={timeRemaining} />

      <div className="p-4 sm:p-6 md:p-8">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-gray-900 mb-4 sm:mb-6 md:mb-8 text-center">
          {currentQuestion.question_text}
        </h2>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8"
          role="group"
          aria-label="Quiz answer options"
        >
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedOption === index;
            const isCorrect = index === currentQuestion.correct_answer_index;

            return (
              <QuizAnswerButton
                key={index}
                option={option}
                index={index}
                isSelected={isSelected}
                isCorrect={isCorrect}
                showResult={showCorrectAnswer}
                hasSubmitted={hasSubmitted}
                onClick={() => onOptionSelect(index)}
              />
            );
          })}
        </div>

        <AnimatePresence>
          {selectedOption !== null && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={onSubmitAnswer}
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
  );
};

export default QuizQuestion;
