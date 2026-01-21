import React from "react";
import { motion } from "framer-motion";
import type { SkeletonProps } from "../config/types";

export const Skeleton: React.FC<SkeletonProps> = ({
  className = "",
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`bg-neutral-800 rounded animate-pulse ${className}`}
    />
  );
};

export const VideoPlayerSkeleton: React.FC = () => {
  return (
    <div className="w-full h-[calc(100vh-16rem)] bg-neutral-900 rounded-lg flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="w-16 h-16 border-4 border-neutral-700 border-t-neutral-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-neutral-400 text-sm">
          Loading video player...
        </p>
      </motion.div>
    </div>
  );
};

export default Skeleton;
