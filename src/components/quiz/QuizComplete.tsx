import React from "react";
import { motion } from "framer-motion";

interface QuizCompleteProps {
  totalScore: number;
  questionsCount: number;
  userName: string;
  userDiscriminator: string;
}

const QuizComplete: React.FC<QuizCompleteProps> = ({
  totalScore,
  questionsCount,
  userName,
  userDiscriminator,
}) => {
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
          of {questionsCount} correct
        </div>
        <p className="text-neutral-700 mb-8">
          Well done,{" "}
          <span className="font-medium">
            {userName}#{userDiscriminator}
          </span>
          !
        </p>
      </motion.div>
    </div>
  );
};

export default QuizComplete;
