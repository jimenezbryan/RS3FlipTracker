import React from "react";
import { BEATS, prog } from "../timeline";

// One short line at the bottom, synced to the voice. A long script line is shown a sentence
// at a time, each for a share of the line's duration proportional to its length.
const CUES = BEATS.flatMap((beat) => {
  const parts = beat.text.match(/[^.!?]+[.!?]+/g)?.map((p) => p.trim()) ?? [beat.text];
  const total = parts.reduce((n, p) => n + p.length, 0);
  let at = beat.voiceStart;
  return parts.map((text) => {
    const length = (beat.voice * text.length) / total;
    const cue = { text, from: at, to: at + length };
    at += length;
    return cue;
  });
});

export const Captions: React.FC<{ t: number }> = ({ t }) => {
  const cue = CUES.find((c) => t >= c.from - 0.05 && t < c.to + 0.25);
  if (!cue) return null;
  const opacity = Math.min(prog(t, cue.from - 0.05, cue.from + 0.12), 1 - prog(t, cue.to + 0.1, cue.to + 0.25));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 54, display: "flex", justifyContent: "center", opacity }}>
      <div style={{
        maxWidth: 1500, padding: "16px 34px", borderRadius: 16, background: "rgba(8, 11, 16, 0.86)",
        border: "1.5px solid rgba(255,255,255,.10)", boxShadow: "0 16px 40px rgba(0,0,0,.5)",
        color: "#fff", fontFamily: "Inter, system-ui, sans-serif", fontWeight: 600, fontSize: 40, lineHeight: 1.25, textAlign: "center", letterSpacing: "-0.01em",
      }}>
        {cue.text}
      </div>
    </div>
  );
};
