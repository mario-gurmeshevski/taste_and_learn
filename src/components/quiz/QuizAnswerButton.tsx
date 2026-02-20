import React from "react";
import { motion } from "framer-motion";
import { FaCheck, FaTimes } from "react-icons/fa";
import { ANSWER_LABELS } from "../../config/constants";
import { getAnswerButtonStyles } from "./QuizState";

interface QuizAnswerButtonProps {
  option: string;
  index: number;
  isSelected: boolean;
  isCorrect: boolean;
  showResult: boolean;
  onClick: () => void;
}

const QuizAnswerButton: React.FC<QuizAnswerButtonProps> = ({
  option,
  index,
  isSelected,
  isCorrect,
  showResult,
  onClick,
}) => {
  const { buttonClass, letterBgClass, letterTextClass } =
    getAnswerButtonStyles(showResult, isCorrect, isSelected);

  return (
    <motion.button
      key={index}
      onClick={onClick}
      whileHover={showResult ? {} : { scale: 1.02 }}
      whileTap={showResult ? {} : { scale: 0.98 }}
      disabled={showResult}
      aria-label={`Answer option ${ANSWER_LABELS[index]}: ${option}`}
      aria-pressed={isSelected}
      aria-disabled={showResult}
      className={`
        relative h-32 sm:h-40 md:h-44 rounded-2xl font-semibold
        transition-all duration-200
        ${showResult ? "cursor-default" : "cursor-pointer"}
        ${buttonClass}
      `}
    >
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

      <div className="flex items-center justify-center h-full px-4 sm:px-6 md:px-8 pt-8 sm:pt-10 pb-4 sm:pb-6">
        <span className="text-base sm:text-lg md:text-xl leading-relaxed text-center text-gray-800">
          {option}
        </span>
      </div>

      {showResult && isCorrect && (
        <div
          className="absolute top-4 right-4 text-green-500"
          aria-label="Correct answer"
        >
          <FaCheck className="w-8 h-8" aria-hidden="true" />
        </div>
      )}
      {showResult && isSelected && !isCorrect && (
        <div
          className="absolute top-4 right-4 text-red-500"
          aria-label="Incorrect answer"
        >
          <FaTimes className="w-8 h-8" aria-hidden="true" />
        </div>
      )}
    </motion.button>
  );
};

export default QuizAnswerButton;
