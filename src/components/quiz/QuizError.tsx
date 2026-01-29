import React from "react";
import { motion } from "framer-motion";

interface QuizErrorProps {
  error: string;
}

const QuizError: React.FC<QuizErrorProps> = ({ error }) => {
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
};

export default QuizError;
