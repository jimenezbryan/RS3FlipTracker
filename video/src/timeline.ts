import { Easing, interpolate } from "remotion";
import vo from "./vo.json";

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
// The app is laid out at a laptop-sized viewport and scaled up, so text is readable in a feed.
export const APP_W = 1440;
export const APP_H = 810;
export const APP_SCALE = WIDTH / APP_W;

// The approved script. `min` is the shortest the beat can be for its on-screen action to finish;
// the beat stretches if the recorded line (vo.json, written by scripts/generate-vo.mjs) is longer.
// `lead` delays the voice inside its beat so the words land on the action they describe.
export const SCRIPT = [
  { id: "hook", text: "This is how I find flips on the Grand Exchange.", est: 3.0, min: 3.6 },
  { id: "scanner", text: "The Scanner scores every item. I filter by signal, and Noxious scythe pops up.", est: 5.0, min: 6.6 },
  { id: "chart", text: "I click it, and here's ninety days of price history, with the buy and sell zones marked.", est: 5.4, min: 7.2 },
  { id: "buy", text: "It's near the bottom of its range, so I buy.", est: 3.0, min: 4.6 },
  { id: "log", text: "When it sells, I log the flip. FlipSync takes off the two percent GE tax and shows what I actually made.", est: 6.6, min: 11.8, lead: 1.5 },
  { id: "end", text: "Every flip, tracked. It's free during beta. Apply at the link.", est: 4.2, min: 6.0 },
] as const;

export type BeatId = (typeof SCRIPT)[number]["id"];
const durations = (vo as { durations: Partial<Record<BeatId, number>> }).durations;
export const HAS_VO = (vo as { generated: boolean }).generated;

const LEAD = 0.25; // silence before each line
const TAIL = 0.45; // and after it
export const BEATS = (() => {
  let at = 0;
  return SCRIPT.map((line) => {
    const voice = durations[line.id] ?? line.est;
    const lead = "lead" in line ? line.lead : LEAD;
    const length = Math.max(line.min, lead + voice + TAIL);
    const beat = { ...line, start: at, voiceStart: at + lead, voice, length };
    at += length;
    return beat;
  });
})();
export const B = Object.fromEntries(BEATS.map((b) => [b.id, b])) as Record<BeatId, (typeof BEATS)[number]>;
export const TOTAL_SECONDS = BEATS.reduce((s, b) => s + b.length, 0);
export const TOTAL_FRAMES = Math.ceil(TOTAL_SECONDS * FPS);

// ---- small animation helpers, all driven by time in seconds ----
export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const easeInOut = Easing.inOut(Easing.cubic);
/** 0 -> 1 between a and b. */
export const prog = (t: number, a: number, b: number, e: (n: number) => number = ease) =>
  interpolate(t, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });
/** Characters of `text` typed by time t, starting at `a`, at `cps` characters per second. */
export const typed = (text: string, t: number, a: number, cps = 14) =>
  text.slice(0, Math.max(0, Math.min(text.length, Math.floor((t - a) * cps))));
export const typeEnd = (text: string, a: number, cps = 14) => a + text.length / cps;
