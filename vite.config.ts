import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/") ||
              id.includes("node_modules/react-router-dom/")) {
            return "react-vendor";
          }
          if (id.includes("node_modules/@supabase/")) {
            return "supabase";
          }
          if (id.includes("node_modules/framer-motion/") ||
              id.includes("node_modules/react-hot-toast/")) {
            return "ui-vendor";
          }
          if (id.includes("node_modules/react-icons/") ||
              id.includes("node_modules/qrcode.react/")) {
            return "icons";
          }
          if (id.includes("node_modules/plyr-react/") ||
              id.includes("node_modules/plyr/")) {
            return "plyr";
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
