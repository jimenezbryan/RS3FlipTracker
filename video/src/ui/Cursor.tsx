import React from "react";

export interface CursorKey { t: number; x: number; y: number }

/** Pointer drawn inside the app layer, with a small press and ripple on each click. */
export const Cursor: React.FC<{ x: number; y: number; t: number; clicks: number[]; scale?: number }> = ({ x, y, t, clicks, scale = 1 }) => {
  const since = Math.min(...clicks.map((c) => (t >= c ? t - c : Infinity)));
  const ripple = since < 0.45 ? since / 0.45 : null;
  const press = since < 0.12 ? 0.86 : 1;
  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: 100, pointerEvents: "none" }}>
      {ripple != null && (
        <div style={{
          position: "absolute", left: -18, top: -18, width: 36, height: 36, borderRadius: 18,
          border: "2px solid hsl(210 90% 65%)", opacity: 1 - ripple, transform: `scale(${0.4 + ripple * 1.1})`,
        }} />
      )}
      <svg width={22} height={22} viewBox="0 0 24 24" style={{ position: "absolute", left: -3, top: -2, transform: `scale(${scale * press})`, transformOrigin: "3px 2px", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.55))" }}>
        <path d="M4 2.5 L4 19 L8.6 14.9 L11.6 21.6 L14.3 20.4 L11.4 13.8 L17.6 13.6 Z" fill="#fff" stroke="#0a0e14" strokeWidth={1.3} strokeLinejoin="round" />
      </svg>
    </div>
  );
};
