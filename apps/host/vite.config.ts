import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Base URL for served assets. GitHub Pages hosts under /<repo>/, so CI sets
// BASE_PATH accordingly. Locally it defaults to "/".
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [svelte()],
  server: {
    fs: {
      // Allow serving files from workspace root (for @swp/plugin-sdk source)
      allow: [".."],
    },
  },
});
