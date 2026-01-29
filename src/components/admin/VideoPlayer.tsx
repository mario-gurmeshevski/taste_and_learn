import React, { lazy, Suspense } from "react";
import { FaSpinner } from "react-icons/fa";
import type { PlyrRef } from "../../config/types";

const Plyr = lazy(() =>
  import("plyr-react").then((module) => ({ default: module.Plyr })),
);

interface VideoPlayerProps {
  videoSrc: { type: "video"; sources: { src: string; type: string }[] };
  videoOptions: { controls: string[] };
  plyrRef: React.RefObject<PlyrRef | null>;
  isPlayerReady: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoSrc,
  videoOptions,
  plyrRef,
  isPlayerReady,
}) => {
  return (
    <div className="w-full h-[calc(100vh-20rem)]">
      <Suspense
        fallback={
          !isPlayerReady && (
            <div className="w-full h-full flex items-center justify-center bg-black text-white">
              <div className="text-center">
                <FaSpinner className="animate-spin h-12 w-12 mx-auto" />
                <p className="mt-4">Loading video player...</p>
              </div>
            </div>
          )
        }
      >
        <Plyr ref={plyrRef} source={videoSrc} options={videoOptions} />
      </Suspense>
    </div>
  );
};

export default VideoPlayer;
