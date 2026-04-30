import WSFMP4 from "../lib/wsfmp4.js";

const media = document.querySelector("#video");
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";

new WSFMP4(media, {
  debug: true,
  mode: "sequence",
  url: `${wsProtocol}//${window.location.host}/stream`,
});
