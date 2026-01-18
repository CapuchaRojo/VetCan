import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isDocker =
  String(process.env.DOCKER || "")
    .trim()
    .toLowerCase() === "true";
const apiTarget = isDocker
  ? "http://vetcan-api:4000"
  : "http://localhost:4000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      },
      "/internal": {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
