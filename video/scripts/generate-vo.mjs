// Generates the voiceover with ElevenLabs and records each line's length in src/vo.json,
// which the timeline reads so every beat stretches to fit its line.
//
//   1. put ELEVENLABS_API_KEY=... in video/.env.local (gitignored)
//   2. npm run vo -- --sample     -> out/vo-sample.mp3 (first line only, to audition the voice)
//   3. npm run vo                 -> public/vo/*.mp3 + src/vo.json
//
// Options: --voice "Chris" (any stock voice name in your account; default below).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DEFAULT_VOICE = "Chris"; // stock ElevenLabs voice: casual American male
const MODEL = "eleven_multilingual_v2";

const env = existsSync(".env.local") ? Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])) : {};
const key = process.env.ELEVENLABS_API_KEY ?? env.ELEVENLABS_API_KEY;
if (!key) { console.error("Missing ELEVENLABS_API_KEY. Add it to video/.env.local"); process.exit(1); }

const args = process.argv.slice(2);
const sample = args.includes("--sample");
const voiceName = args.includes("--voice") ? args[args.indexOf("--voice") + 1] : DEFAULT_VOICE;

// The script lives in src/timeline.ts; read it from there so there is one copy.
const timeline = readFileSync("src/timeline.ts", "utf8");
const lines = [...timeline.matchAll(/\{ id: "(\w+)", text: "([^"]+)"/g)].map((m) => ({ id: m[1], text: m[2] }));
if (lines.length === 0) throw new Error("Could not read SCRIPT from src/timeline.ts");

const api = (path, init = {}) => fetch(`https://api.elevenlabs.io${path}`, { ...init, headers: { "xi-api-key": key, "content-type": "application/json", ...(init.headers ?? {}) } });
const voicesRes = await api("/v1/voices");
if (!voicesRes.ok) throw new Error(`Listing voices failed: ${voicesRes.status} ${await voicesRes.text()}`);
const { voices } = await voicesRes.json();
const voice = voices.find((v) => v.name.toLowerCase().startsWith(voiceName.toLowerCase()));
if (!voice) throw new Error(`No voice named "${voiceName}". Available: ${voices.map((v) => v.name).join(", ")}`);
console.log(`Voice: ${voice.name} (${voice.voice_id})`);

const speak = async (text, file) => {
  const res = await api(`/v1/text-to-speech/${voice.voice_id}?output_format=mp3_44100_128`, {
    method: "POST",
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25 } }),
  });
  if (!res.ok) throw new Error(`TTS failed: ${res.status} ${await res.text()}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());
};

if (sample) {
  mkdirSync("out", { recursive: true });
  console.log(`out/vo-sample.mp3  ${(await speak(lines[0].text, "out/vo-sample.mp3")).toFixed(2)}s`);
} else {
  mkdirSync("public/vo", { recursive: true });
  const durations = {};
  for (const line of lines) {
    durations[line.id] = await speak(line.text, `public/vo/${line.id}.mp3`);
    console.log(`${line.id.padEnd(8)} ${durations[line.id].toFixed(2)}s  ${line.text}`);
  }
  writeFileSync("src/vo.json", JSON.stringify({ generated: true, voice: voice.name, durations }, null, 2) + "\n");
  console.log("Wrote src/vo.json. Run `npm run render`.");
}
