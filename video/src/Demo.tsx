import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { AppShell, SIDEBAR_ICON, SIDEBAR_OPEN, navItemY } from "./ui/AppShell";
import { Cursor, type CursorKey } from "./ui/Cursor";
import { Captions } from "./ui/Captions";
import { ScannerScreen } from "./screens/Scanner";
import { DashboardScreen, type FormFocus } from "./screens/Dashboard";
import { EndCard } from "./screens/EndCard";
import { SCYTHE_HISTORY, DEMO_FLIP } from "./data/items";
import { APP_H, APP_SCALE, APP_W, B, BEATS, FPS, HAS_VO, HEIGHT, TOTAL_SECONDS, WIDTH, easeInOut, prog, typed } from "./timeline";
import audio from "./audio.json";

loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
loadMono("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });

// ---------------------------------------------------------------------------------------------
// The whole demo is choreographed here, in seconds relative to each beat of the script, so the
// actions stay in sync with the voice whatever length the recorded lines turn out to be.
// ---------------------------------------------------------------------------------------------
const h = B.hook.start, s = B.scanner.start, c = B.chart.start, b = B.buy.start, l = B.log.start, e = B.end.start;

const T = {
  collapseClick: h + 1.5,
  checkClick: s + 1.9,
  rowHover: s + 3.9,
  rowClick: c + 0.55,
  chartDrawFrom: c + 1.3,
  chartDrawTo: c + 3.4,
  hoverPoint: b + 1.1,
  navClick: l + 0.75,
  routeSwitch: l + 0.9,
  itemClick: l + 1.6,
  itemType: l + 1.75,
  suggestionClick: l + 2.75,
  buyClick: l + 3.3,
  buyType: l + 3.4,
  sellClick: l + 4.15,
  sellType: l + 4.3,
  taxShown: l + 4.3 + 4 / 9,
  addClick: l + 8.4,
  submitted: l + 8.55,
};
export const CLICKS = [T.collapseClick, T.checkClick, T.rowClick, T.navClick, T.itemClick, T.suggestionClick, T.buyClick, T.sellClick, T.addClick];
const LAST = SCYTHE_HISTORY.length - 1;

// Cursor path, in the app's own coordinate space (1440x810).
const CURSOR: CursorKey[] = [
  { t: 0, x: 760, y: 430 },
  { t: h + 0.9, x: 760, y: 430 },
  { t: h + 1.4, x: 286, y: 24 },
  { t: s + 0.9, x: 286, y: 24 },
  { t: s + 1.75, x: 829, y: 298 },
  { t: s + 3.1, x: 829, y: 298 },
  { t: s + 3.9, x: 300, y: 556 },
  { t: c + 1.2, x: 300, y: 556 },
  { t: c + 2.0, x: 420, y: 140 },
  { t: b + 0.3, x: 500, y: 330 },
  { t: b + 1.1, x: 702, y: 452 },
  { t: l + 0.15, x: 702, y: 452 },
  { t: l + 0.7, x: 24, y: navItemY("/") },
  { t: l + 1.05, x: 24, y: navItemY("/") },
  { t: l + 1.55, x: 560, y: 189 },
  { t: l + 2.3, x: 560, y: 189 },
  { t: l + 2.7, x: 420, y: 241 },
  { t: l + 2.85, x: 420, y: 241 },
  { t: l + 3.25, x: 330, y: 461 },
  { t: l + 3.75, x: 330, y: 461 },
  { t: l + 4.1, x: 930, y: 461 },
  { t: l + 7.6, x: 1010, y: 520 },
  { t: l + 8.3, x: 720, y: 659 },
  { t: l + 9.4, x: 720, y: 659 },
  { t: l + 10.4, x: 330, y: 392 },
];

// Camera: the point of the app we are looking at and how far we are pushed in.
const CAMERA: { t: number; x: number; y: number; z: number }[] = [
  { t: 0, x: 720, y: 405, z: 1 },
  { t: s + 0.4, x: 720, y: 405, z: 1.04 },
  { t: s + 1.6, x: 780, y: 330, z: 1.3 },
  { t: s + 2.6, x: 780, y: 330, z: 1.3 },
  { t: s + 3.8, x: 720, y: 405, z: 1 },
  { t: c + 0.5, x: 720, y: 405, z: 1 },
  { t: c + 1.5, x: 500, y: 400, z: 1.42 },
  { t: b + 0.1, x: 500, y: 400, z: 1.46 },
  { t: b + 1.2, x: 560, y: 390, z: 2.1 },
  { t: l + 0.1, x: 560, y: 390, z: 2.15 },
  { t: l + 0.7, x: 720, y: 405, z: 1 },
  { t: l + 1.3, x: 720, y: 405, z: 1 },
  { t: l + 2.0, x: 660, y: 300, z: 1.35 },
  { t: l + 3.0, x: 660, y: 300, z: 1.35 },
  { t: l + 3.6, x: 640, y: 410, z: 1.4 },
  { t: l + 4.6, x: 640, y: 410, z: 1.4 },
  { t: l + 5.5, x: 1030, y: 480, z: 2.1 },
  { t: l + 7.5, x: 1030, y: 480, z: 2.2 },
  { t: l + 8.2, x: 720, y: 470, z: 1.3 },
  { t: l + 8.9, x: 720, y: 470, z: 1.3 },
  { t: l + 9.9, x: 480, y: 390, z: 1.8 },
  { t: l + 13, x: 480, y: 390, z: 1.88 },
];

function track<K extends { t: number }>(keys: K[], t: number, fields: (keyof K)[]): Record<string, number> {
  let i = 0;
  while (i < keys.length - 2 && t >= keys[i + 1].t) i++;
  const a = keys[i], z = keys[Math.min(i + 1, keys.length - 1)];
  const p = z.t === a.t ? 1 : prog(t, a.t, z.t, easeInOut);
  return Object.fromEntries(fields.map((f) => [f, (a[f] as number) + ((z[f] as number) - (a[f] as number)) * p]));
}

export const Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;

  // --- app state at time t ---
  const sidebarWidth = interpolate(prog(t, T.collapseClick + 0.05, T.collapseClick + 0.5), [0, 1], [SIDEBAR_OPEN, SIDEBAR_ICON]);
  const onDashboard = t >= T.routeSwitch;
  const pressed = Math.abs(t - T.collapseClick) < 0.1 ? "trigger" : Math.abs(t - T.navClick) < 0.12 ? "/" : null;

  const expand = prog(t, T.rowClick + 0.03, T.rowClick + 0.6);
  const scannerScroll = 392 * prog(t, T.rowClick + 0.05, T.rowClick + 0.9, easeInOut);

  const itemTyped = typed("nox", t, T.itemType, 7);
  const selected = t >= T.suggestionClick;
  const focus: FormFocus =
    t >= T.sellClick && t < T.addClick ? "sell" : t >= T.buyClick && t < T.sellClick ? "buy" : t >= T.itemClick && t < T.suggestionClick ? "item" : null;
  const dashScroll =
    150 * prog(t, l + 1.0, l + 1.6, easeInOut) + 180 * prog(t, l + 2.85, l + 3.2, easeInOut) + 380 * prog(t, T.submitted + 0.1, T.submitted + 1.2, easeInOut);

  // --- camera ---
  const cam = track(CAMERA, t, ["x", "y", "z"]);
  const S = APP_SCALE * cam.z;
  const tx = Math.min(0, Math.max(WIDTH - APP_W * S, WIDTH / 2 - cam.x * S));
  const ty = Math.min(0, Math.max(HEIGHT - APP_H * S, HEIGHT / 2 - cam.y * S));
  const cur = track(CURSOR, t, ["x", "y"]);

  const endIn = prog(t, e - 0.05, e + 0.5);
  const routeFade = 1 - Math.abs(prog(t, T.routeSwitch - 0.12, T.routeSwitch + 0.12, (n) => n) * 2 - 1); // dip at the page change

  return (
    <AbsoluteFill style={{ background: "#0a0e14" }}>
      <AbsoluteFill style={{ opacity: 1 - endIn }}>
        <div style={{ width: APP_W, height: APP_H, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${S})`, position: "absolute" }}>
          <AppShell route={onDashboard ? "/" : "/scanner"} sidebarWidth={sidebarWidth} pressed={pressed}>
            <div style={{ opacity: 1 - 0.85 * routeFade, position: "absolute", inset: 0 }}>
              {onDashboard ? (
                <DashboardScreen
                  scrollY={dashScroll}
                  itemText={selected ? "Noxious scythe" : itemTyped}
                  suggestions={selected ? 0 : prog(t, T.itemType + 0.3, T.itemType + 0.5)}
                  suggestionHover={t >= l + 2.6}
                  selected={selected}
                  buyText={typed(DEMO_FLIP.buyTyped, t, T.buyType, 9)}
                  sellText={typed(DEMO_FLIP.sellTyped, t, T.sellType, 9)}
                  focus={focus}
                  addPressed={Math.abs(t - T.addClick) < 0.1}
                  submitted={prog(t, T.submitted, T.submitted + 0.6)}
                />
              ) : (
                <ScannerScreen
                  mainWidth={APP_W - sidebarWidth}
                  scrollY={scannerScroll}
                  signalsOnly={prog(t, T.checkClick + 0.05, T.checkClick + 0.6, easeInOut)}
                  checked={t >= T.checkClick}
                  hoverRow={t >= T.rowHover - 0.15}
                  expand={expand}
                  chartReveal={prog(t, T.chartDrawFrom, T.chartDrawTo, easeInOut)}
                  hoverIndex={t >= T.hoverPoint ? LAST : null}
                  zonePulse={Math.max(0, Math.sin(Math.PI * prog(t, T.hoverPoint + 0.2, T.hoverPoint + 1.4, (n) => n)))}
                />
              )}
            </div>
          </AppShell>
          <Cursor x={cur.x} y={cur.y} t={t} clicks={CLICKS} scale={1 / Math.sqrt(cam.z)} />
        </div>
      </AbsoluteFill>

      {endIn > 0 && <EndCard t={t - e} opacity={endIn} />}
      <Captions t={t} />

      {/* --- sound --- */}
      {HAS_VO && BEATS.map((beat) => (
        <Sequence key={beat.id} from={Math.round(beat.voiceStart * FPS)} layout="none">
          <Audio src={staticFile(`vo/${beat.id}.mp3`)} />
        </Sequence>
      ))}
      {audio.music && (
        <Audio
          src={staticFile("audio/bed.wav")}
          volume={(f) => (HAS_VO ? 0.1 : 0.6) * interpolate(f, [0, 20, TOTAL_SECONDS * FPS - 45, TOTAL_SECONDS * FPS], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      )}
      {audio.sfx && CLICKS.map((at) => (
        <Sequence key={at} from={Math.round(at * FPS)} layout="none"><Audio src={staticFile("audio/click.wav")} volume={0.3} /></Sequence>
      ))}
      {audio.sfx && [T.itemType, T.buyType, T.sellType].map((at) => (
        <Sequence key={at} from={Math.round(at * FPS)} layout="none"><Audio src={staticFile("audio/typing.wav")} volume={0.25} /></Sequence>
      ))}
      {audio.sfx && [T.taxShown + 0.05, T.submitted + 0.1, e + 0.1].map((at) => (
        <Sequence key={at} from={Math.round(at * FPS)} layout="none"><Audio src={staticFile("audio/chime.wav")} volume={0.22} /></Sequence>
      ))}
      {audio.sfx && [T.rowClick + 0.05, T.routeSwitch - 0.1, e - 0.15].map((at) => (
        <Sequence key={at} from={Math.round(at * FPS)} layout="none"><Audio src={staticFile("audio/whoosh.wav")} volume={0.18} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
