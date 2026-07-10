import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createReadStream, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const browserTestRom = fileURLToPath(
  new URL("../artifacts/phase9/tetris-recovery/rom.bin", import.meta.url),
);

export default defineConfig({
  plugins: [
    react(),
    {
      name: "drive16-browser-test-rom",
      configureServer(server) {
        server.middlewares.use("/__drive16_test_rom.bin", (_request, response) => {
          if (!existsSync(browserTestRom)) {
            response.statusCode = 404;
            response.end("Recovered browser test ROM is missing.");
            return;
          }
          response.setHeader("Content-Type", "application/octet-stream");
          response.setHeader("Content-Length", statSync(browserTestRom).size);
          createReadStream(browserTestRom).pipe(response);
        });
      },
    },
  ],
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
