import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Raise warning limit so we don't get noise after splitting
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Firebase SDK → its own chunk
          if (id.includes("node_modules/firebase")) {
            return "firebase";
          }
          // React + React-DOM → vendor chunk
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "react-vendor";
          }
          // React-Router → separate chunk
          if (id.includes("node_modules/react-router") || id.includes("node_modules/@remix-run")) {
            return "router";
          }
        },
      },
    },
  },
});
