import React from "react";
import { FaPlay, FaPause } from "react-icons/fa";
import type { Question } from "../../config/types";

interface QuizWaitingProps {
  answeredCount: number;
  questionsCount: number;
  videoPosition: number;
  nextQuestion: Question | undefined;
  lastKnownState: {
    position: number;
    timestamp: number;
    isPlaying: boolean;
  } | null;
}

const QuizWaiting: React.FC<QuizWaitingProps> = ({
  answeredCount,
  questionsCount,
  videoPosition,
  nextQuestion,
  lastKnownState,
}) => {
  return (
    <div className="bg-white border border-neutral-200 p-6 text-center">
      <p className="text-neutral-600">
        Waiting for next question... ({answeredCount}/{questionsCount} answered)
      </p>
      <p className="text-sm text-neutral-500 mt-2">
        Video position: {videoPosition.toFixed(1)}s
      </p>
      {nextQuestion ? (
        <p className="text-sm text-neutral-600 mt-2 font-medium">
          Next question in{" "}
          {Math.ceil(
            Math.max(0, nextQuestion.start_timestamp - videoPosition),
          )}
          s
        </p>
      ) : answeredCount < questionsCount ? (
        <p className="text-sm text-neutral-500 mt-2">
          All remaining questions passed
        </p>
      ) : null}
      {lastKnownState && (
        <p className="text-xs text-neutral-400 mt-1">
          Broadcast:{" "}
          <span className="inline-flex items-center gap-1">
            {lastKnownState.isPlaying ? (
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
      )}
    </div>
  );
};

export default QuizWaiting;
