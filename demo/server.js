import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const host = process.env.WSFMP4_HOST || "127.0.0.1";
const port = Number(process.env.WSFMP4_PORT || 6060);
const pathname = process.env.WSFMP4_PATH || "/stream";
const chunkSize = Number(process.env.WSFMP4_CHUNK_SIZE || 256 * 1024);
const intervalMs = Number(process.env.WSFMP4_INTERVAL_MS || 200);
const sourceDir = process.env.WSFMP4_SOURCE_DIR || path.join(__dirname, "segments");

if (!fs.existsSync(sourceDir)) {
  console.error(`missing demo segment directory: ${sourceDir}`);
  process.exit(1);
}

const segmentFiles = fs
  .readdirSync(sourceDir)
  .filter((file) => file.endsWith(".mp4"))
  .sort()
  .map((file) => path.join(sourceDir, file));

if (!segmentFiles.length) {
  console.error(`no mp4 segments found in: ${sourceDir}`);
  process.exit(1);
}

const payloads = segmentFiles.map((file) => ({
  file,
  buffer: fs.readFileSync(file),
}));

const wss = new WebSocketServer({ host, port, path: pathname });

wss.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`port already in use: ws://${host}:${port}${pathname}`);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});

wss.on("connection", (ws, req) => {
  console.log(`client connected: ${req.socket.remoteAddress ?? "unknown"}`);

  let fileIndex = 0;
  let offset = 0;
  const timer = setInterval(() => {
    if (ws.readyState !== ws.OPEN) {
      clearInterval(timer);
      return;
    }

    if (fileIndex >= payloads.length) {
      clearInterval(timer);
      ws.close(1000, "demo finished");
      return;
    }

    const payload = payloads[fileIndex].buffer;
    const next = Math.min(offset + chunkSize, payload.byteLength);
    ws.send(payload.subarray(offset, next));
    offset = next;

    if (offset >= payload.byteLength) {
      fileIndex += 1;
      offset = 0;
    }
  }, intervalMs);

  ws.on("close", () => {
    clearInterval(timer);
    console.log("client disconnected");
  });
});

wss.on("listening", () => {
  console.log(`wsfmp4 demo server: ws://${host}:${port}${pathname}`);
  console.log(`segments: ${sourceDir}`);
  console.log(`files=${payloads.length}`);
  console.log(`chunkSize=${chunkSize} intervalMs=${intervalMs}`);
});
