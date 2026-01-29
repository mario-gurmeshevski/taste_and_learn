import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          // Supabase
          "supabase": ["@supabase/supabase-js"],
          // UI/Animations
          "ui-vendor": ["framer-motion", "react-hot-toast"],
          // Icons
          "icons": ["react-icons/fa", "react-icons", "qrcode.react"],
          // Video player (loaded separately due to size)
          "plyr": ["plyr-react"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
