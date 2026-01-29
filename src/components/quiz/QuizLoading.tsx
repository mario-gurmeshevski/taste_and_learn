import React from "react";
import { motion } from "framer-motion";

const QuizLoading: React.FC = () => {
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
};

export default QuizLoading;
