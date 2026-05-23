import WSFMP4 from "../lib/wsfmp4.js";

// ── WebSocket tracker ────────────────────────────────────────────────────────
// Intercept the native constructor so we can read readyState without
// patching the library itself.
const _NativeWS = window.WebSocket;
let _ws = null;

class TrackedWS extends _NativeWS {
  constructor(url, protocols) {
    super(url, ...(protocols !== undefined ? [protocols] : []));
    _ws = this;
  }
}
window.WebSocket = TrackedWS;

// ── MediaSource intercept — grab codec string ────────────────────────────────
const _addSB = MediaSource.prototype.addSourceBuffer;
MediaSource.prototype.addSourceBuffer = function (mime) {
  const match = mime.match(/codecs="([^"]+)"/);
  document.getElementById("cb-codec").textContent = match ? match[1] : mime;
  return _addSB.call(this, mime);
};

// ── Config ───────────────────────────────────────────────────────────────────
const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
// Allow ?ws=wss://host/path override — useful for deployed demos where
// the WebSocket backend is not co-located with the static frontend.
const wsParam = new URLSearchParams(location.search).get("ws");
const OPTIONS = {
  url:   wsParam || `${wsProto}//${location.host}/stream`,
  mode:  "sequence",
  debug: false,
};

// ── Init player ──────────────────────────────────────────────────────────────
const video = document.getElementById("video");
new WSFMP4(video, OPTIONS);

// ── Populate configuration panel ─────────────────────────────────────────────
document.getElementById("cb-mode").textContent = OPTIONS.mode;

;(function renderOpts() {
  const display = {
    mode:           OPTIONS.mode,
    debug:          OPTIONS.debug,
    retry:          OPTIONS.retry  ?? false,
    live:           OPTIONS.live   ?? false,
    liveMaxLatency: OPTIONS.liveMaxLatency ?? 0,
    cacheMax:       OPTIONS.cacheMax ?? 8,
  };

  const container = document.getElementById("opts-rows");

  for (const [k, v] of Object.entries(display)) {
    const isBool = typeof v === "boolean";
    const cls    = isBool ? (v ? "row-val c-green" : "row-val c-muted") : "row-val c-amber";
    const label  = typeof v === "string" ? `"${v}"` : String(v);

    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<span class="row-key">${k}</span><span class="${cls}">${label}</span>`;
    container.appendChild(row);
  }
})();

// ── Code snippet ─────────────────────────────────────────────────────────────
document.getElementById("code-snippet").innerHTML = [
  `<span class="kw">import</span> WSFMP4 <span class="kw">from</span> <span class="str">"wsfmp4.js"</span>;`,
  ``,
  `<span class="kw">const</span> player = <span class="kw">new</span> <span class="fn">WSFMP4</span>(document.<span class="fn">querySelector</span>(<span class="str">"#video"</span>), {`,
  `  url:   <span class="str">"ws://127.0.0.1:6060/stream"</span>,`,
  `  mode:  <span class="str">"sequence"</span>,   <span class="cm">// "sequence" | "segments"</span>`,
  `  debug: <span class="kw">false</span>,`,
  ``,
  `  <span class="cm">// live stream options</span>`,
  `  live:           <span class="kw">false</span>,`,
  `  retry:          <span class="kw">false</span>,`,
  `  liveMaxLatency: <span class="num">8</span>,   <span class="cm">// seconds</span>`,
  `  cacheMax:       <span class="num">4</span>,   <span class="cm">// seconds of buffer to retain</span>`,
  `});`,
  ``,
  `<span class="cm">// clean up when done</span>`,
  `player.<span class="fn">destroy</span>();`,
].join("\n");

// ── DOM refs ─────────────────────────────────────────────────────────────────
const wsBadge     = document.getElementById("ws-badge");
const wsLabel     = document.getElementById("ws-label");
const overlay     = document.getElementById("video-overlay");
const overlayText = document.getElementById("overlay-text");
const sCur  = document.getElementById("s-cur");
const sBs   = document.getElementById("s-bs");
const sBe   = document.getElementById("s-be");
const sAh   = document.getElementById("s-ah");
const sRs   = document.getElementById("s-rs");
const sNs   = document.getElementById("s-ns");
const cbBuf = document.getElementById("cb-buf");
const cbRes = document.getElementById("cb-res");

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n, d = 2) => n.toFixed(d) + "s";

const READY_LABELS = [
  "HAVE_NOTHING",
  "HAVE_METADATA",
  "HAVE_CURRENT_DATA",
  "HAVE_FUTURE_DATA",
  "HAVE_ENOUGH_DATA",
];

const NET_LABELS = [
  "NETWORK_EMPTY",
  "NETWORK_IDLE",
  "NETWORK_LOADING",
  "NETWORK_NO_SOURCE",
];

function setVal(el, text, colorClass) {
  if (el.textContent !== text) {
    el.textContent = text;
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 300);
  }
  if (colorClass !== undefined) {
    el.className = `row-val ${colorClass}`;
  }
}

// ── Stats loop ────────────────────────────────────────────────────────────────
function tick() {
  // — WebSocket status —
  const wsState = _ws ? _ws.readyState : -1;

  if (wsState === 1 /* OPEN */) {
    wsBadge.className = "ws-badge state-connected";
    wsLabel.textContent = "connected";
  } else if (wsState === 3 /* CLOSED */) {
    wsBadge.className = "ws-badge";
    wsLabel.textContent = "closed";
  } else {
    wsBadge.className = "ws-badge state-connecting";
    wsLabel.textContent = wsState === 2 ? "closing" : "connecting";
  }

  // — Video stats —
  const cur      = video.currentTime;
  const buffered = video.buffered;
  const hasRange = buffered.length > 0;
  const bs       = hasRange ? buffered.start(buffered.length - 1) : null;
  const be       = hasRange ? buffered.end(buffered.length - 1)   : null;
  const ahead    = be != null ? be - cur : null;

  setVal(sCur, fmt(cur));
  setVal(sBs,  bs    != null ? fmt(bs)    : "—");
  setVal(sBe,  be    != null ? fmt(be)    : "—");

  if (ahead != null) {
    const cls = ahead < 1 ? "flash" : ahead > 5 ? "c-green" : "";
    setVal(sAh, fmt(ahead), cls);
  } else {
    setVal(sAh, "—");
  }

  const rsLabel = READY_LABELS[video.readyState] ?? "—";
  const rsClass = video.readyState >= 3 ? "c-green" : video.readyState === 0 ? "c-muted" : "";
  setVal(sRs, rsLabel, rsClass);

  const nsLabel = NET_LABELS[video.networkState] ?? "—";
  const nsClass = video.networkState === 2 ? "c-amber" : video.networkState === 1 ? "c-green" : "c-muted";
  setVal(sNs, nsLabel, nsClass);

  // — Codec bar extras —
  if (hasRange) {
    cbBuf.textContent = `${fmt(bs)} → ${fmt(be)}`;
  }

  if (video.videoWidth) {
    cbRes.textContent = `${video.videoWidth} × ${video.videoHeight}`;
  }

  // — Overlay —
  const isPlaying = !video.paused && !video.ended && video.readyState >= 3;
  if (isPlaying) {
    overlay.classList.add("hidden");
  } else {
    overlay.classList.remove("hidden");
    if (wsState === 3) {
      overlayText.textContent = "stream ended";
    } else if (wsState === 1 && video.readyState < 3) {
      overlayText.textContent = "buffering";
    } else {
      overlayText.textContent = "connecting to stream";
    }
  }
}

// resolution can change late
video.addEventListener("loadedmetadata", () => {
  cbRes.textContent = `${video.videoWidth} × ${video.videoHeight}`;
});

setInterval(tick, 250);

// ── Theme toggle ──────────────────────────────────────────────────────────────
document.getElementById("theme-btn").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("wsfmp4-theme", next);
});
