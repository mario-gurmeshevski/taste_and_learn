import React from "react";
import { motion } from "framer-motion";
import {
  FaPlay,
  FaPause,
  FaRedo,
  FaBackward,
  FaForward,
  FaQrcode,
} from "react-icons/fa";
import { SKIP_AMOUNT } from "../../config/constants";
import { getButtonAnimationProps } from "../../lib/animations";

interface VideoControlsProps {
  isPlayerReady: boolean;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  onShowQR: () => void;
}

const VideoControls: React.FC<VideoControlsProps> = ({
  isPlayerReady,
  onPlay,
  onPause,
  onRestart,
  onSkipBackward,
  onSkipForward,
  onShowQR,
}) => {
  return (
    <div
      className="flex flex-wrap gap-2 mb-3 sm:mb-4"
      role="group"
      aria-label="Broadcast controls"
    >
      <motion.button
        onClick={onPlay}
        disabled={!isPlayerReady}
        {...getButtonAnimationProps(0.1, isPlayerReady)}
        aria-label="Start or play broadcast"
        className={`${
          isPlayerReady
            ? "bg-green-500/30 border-green-400/30 shadow-lg shadow-green-500/20"
            : "bg-gray-500/20 border-gray-500/20 cursor-not-allowed opacity-50"
        } backdrop-blur-md text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border flex items-center gap-1 sm:gap-2`}
      >
        <FaPlay className="text-sm" aria-hidden="true" /> Start/Play
      </motion.button>

      <motion.button
        onClick={onPause}
        disabled={!isPlayerReady}
        {...getButtonAnimationProps(0.15, isPlayerReady)}
        aria-label="Pause broadcast"
        className={`${
          isPlayerReady
            ? "bg-yellow-500/30 border-yellow-400/30 shadow-lg shadow-yellow-500/20"
            : "bg-gray-500/20 border-gray-500/20 cursor-not-allowed opacity-50"
        } backdrop-blur-md text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border flex items-center gap-1 sm:gap-2`}
      >
        <FaPause className="text-sm" aria-hidden="true" /> Pause
      </motion.button>

      <motion.button
        onClick={onRestart}
        disabled={!isPlayerReady}
        {...getButtonAnimationProps(0.25, isPlayerReady)}
        aria-label="Restart broadcast from beginning"
        className={`${
          isPlayerReady
            ? "bg-blue-500/30 border-blue-400/30 shadow-lg shadow-blue-500/20"
            : "bg-gray-500/20 border-gray-500/20 cursor-not-allowed opacity-50"
        } backdrop-blur-md text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border flex items-center gap-1 sm:gap-2`}
      >
        <FaRedo className="text-sm" aria-hidden="true" /> Restart
      </motion.button>

      <motion.button
        onClick={onSkipBackward}
        disabled={!isPlayerReady}
        {...getButtonAnimationProps(0.3, isPlayerReady)}
        aria-label={`Skip backward ${SKIP_AMOUNT} seconds`}
        className={`${
          isPlayerReady
            ? "bg-neutral-400/20 border-neutral-400/20 shadow-lg shadow-neutral-500/10"
            : "bg-gray-500/20 border-gray-500/20 cursor-not-allowed opacity-50"
        } backdrop-blur-md text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border flex items-center gap-1 sm:gap-2`}
      >
        <FaBackward className="text-sm" aria-hidden="true" /> -10s
      </motion.button>

      <motion.button
        onClick={onSkipForward}
        disabled={!isPlayerReady}
        {...getButtonAnimationProps(0.35, isPlayerReady)}
        aria-label={`Skip forward ${SKIP_AMOUNT} seconds`}
        className={`${
          isPlayerReady
            ? "bg-neutral-400/20 border-neutral-400/20 shadow-lg shadow-neutral-500/10"
            : "bg-gray-500/20 border-gray-500/20 cursor-not-allowed opacity-50"
        } backdrop-blur-md text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border flex items-center gap-1 sm:gap-2`}
      >
        <FaForward className="text-sm" aria-hidden="true" /> +10s
      </motion.button>

      <motion.button
        onClick={onShowQR}
        {...getButtonAnimationProps(0.4)}
        aria-label="Show quiz QR code"
        className="bg-purple-500/30 border-purple-400/30 shadow-lg shadow-purple-500/20 backdrop-blur-md text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium border flex items-center gap-1 sm:gap-2"
      >
        <FaQrcode className="text-sm" aria-hidden="true" /> Quiz QR
      </motion.button>
    </div>
  );
};

export default VideoControls;
