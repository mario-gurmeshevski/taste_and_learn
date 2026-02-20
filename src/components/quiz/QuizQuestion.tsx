import React from "react";
import { motion } from "framer-motion";
import type { Question } from "../../config/types";
import QuizHeader from "./QuizHeader";
import QuizAnswerButton from "./QuizAnswerButton";

interface QuizQuestionProps {
  currentQuestion: Question;
  selectedOption: number | null;
  showCorrectAnswer: boolean;
  timeRemaining: number;
  onOptionSelect: (index: number) => void;
}

const QuizQuestion: React.FC<QuizQuestionProps> = ({
  currentQuestion,
  selectedOption,
  showCorrectAnswer,
  timeRemaining,
  onOptionSelect,
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
                onClick={() => onOptionSelect(index)}
              />
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default QuizQuestion;
