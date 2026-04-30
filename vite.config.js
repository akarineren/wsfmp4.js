import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "./lib/wsfmp4.js",
      name: "wsfmp4",
      formats: ["es", "umd", "iife", "cjs"],
      fileName: (format) => {
        if (format == 'es') {
          return `wsfmp4.js`
        }
        return `wsfmp4.${format}.js`
      },
    }
  },
  server: {
    host: "0.0.0.0",
    proxy: {
      "/stream": {
        target: "ws://127.0.0.1:6060",
        ws: true,
        configure: (proxy) => {
          proxy.on("error", (err) => {
            if (err.code === "ECONNRESET") {
              return;
            }
            console.error("[vite proxy]", err);
          });
        },
      },
    },
  }
});
