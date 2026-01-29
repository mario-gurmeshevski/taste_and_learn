import React from "react";

interface QuizHeaderProps {
  timeRemaining: number;
}

const QuizHeader: React.FC<QuizHeaderProps> = ({ timeRemaining }) => {
  return (
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
  );
};

export default QuizHeader;
