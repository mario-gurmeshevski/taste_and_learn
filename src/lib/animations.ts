import type { Transition } from "framer-motion";

export function getButtonAnimationProps(
  delay: number,
  enabled: boolean = true,
): {
  initial: { opacity: number; scale: number };
  animate: { opacity: number; scale: number };
  transition: Transition;
  whileHover:
    | { scale: number; y: number; transition: { duration: number } }
    | Record<string, never>;
  whileTap:
    | { scale: number; transition: { duration: number } }
    | Record<string, never>;
} {
  return {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    transition: { delay },
    whileHover: enabled
      ? {
          scale: 1.05,
          y: -2,
          transition: { duration: 0.2 },
        }
      : ({} as Record<string, never>),
    whileTap: enabled
      ? { scale: 0.95, transition: { duration: 0.1 } }
      : ({} as Record<string, never>),
  };
}
