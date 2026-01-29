import React from "react";
import { motion } from "framer-motion";
import { FaPlay, FaPause } from "react-icons/fa";
import type { BroadcastState } from "../../config/types";

interface BroadcastStatusProps {
  broadcastState: BroadcastState | null;
}

const BroadcastStatus: React.FC<BroadcastStatusProps> = ({
  broadcastState,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="text-white text-xs sm:text-sm"
    >
      <p>
        Status:
        <span className="font-bold flex items-center gap-2">
          {broadcastState?.is_playing ? (
            <>
              <FaPlay aria-hidden="true" /> Playing
            </>
          ) : (
            <>
              <FaPause aria-hidden="true" /> Paused
            </>
          )}
        </span>
      </p>
      <p>
        Current Time:
        <span className="font-bold">
          {(broadcastState?.current_position ?? 0).toFixed(2)}s
        </span>
      </p>
    </motion.div>
  );
};

export default BroadcastStatus;
