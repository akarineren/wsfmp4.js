import { defineConfig } from "vite";

// Builds the demo as a static web app (not the library).
// Used by Vercel: outputs index.html + bundled assets to demo-dist/.
export default defineConfig({
  build: {
    outDir: "demo-dist",
    emptyOutDir: true,
  },
});
