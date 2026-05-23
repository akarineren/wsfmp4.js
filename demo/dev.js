import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const children = [];
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const frontendPort = Number(process.env.WSFMP4_FRONTEND_PORT || 4000);
const viteBin = path.join(
  rootDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vite.cmd" : "vite",
);

function start(name, command, args) {
  const child = spawn(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      WSFMP4_FRONTEND_PORT: String(frontendPort),
    },
  });

  children.push(child);

  child.on("error", (err) => {
    console.error(`${name} failed to start: ${err.message}`);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.log(`${name} exited with ${reason}`);
    shutdown(code ?? 0);
  });
}

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  process.exitCode = code;

  while (children.length) {
    const child = children.pop();
    if (child && !child.killed) {
      child.kill("SIGINT");
    }
  }
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start("demo:server", process.execPath, ["./demo/server.js"]);
start("vite", viteBin, []);
