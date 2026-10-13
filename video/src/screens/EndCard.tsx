import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { ChevronRight, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ease, prog } from "../timeline";

// End card in the landing page's own look (client/src/pages/Landing.tsx): same gradient,
// same button text, same "Free during beta" line.
const rise = (t: number, at: number) => { const p = prog(t, at, at + 0.5, ease); return { opacity: p, transform: `translateY(${(1 - p) * 24}px)` }; };

export const EndCard: React.FC<{ t: number; opacity: number }> = ({ t, opacity }) => (
  <AbsoluteFill className="dark font-sans text-foreground antialiased" style={{ opacity, background: "linear-gradient(180deg, #0a0e14, #0f1419 50%, #0a0e14)" }}>
    <div style={{ position: "absolute", left: 280, top: -260, width: 1100, height: 1100, borderRadius: "50%", background: "radial-gradient(circle, hsl(145 65% 50% / .16), transparent 62%)" }} />
    <div style={{ position: "absolute", left: 900, top: 240, width: 1100, height: 1100, borderRadius: "50%", background: "radial-gradient(circle, hsl(210 90% 55% / .13), transparent 62%)" }} />
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 150 }}>
      <div style={{ ...rise(t, 0.15), display: "flex", alignItems: "center", gap: 28 }}>
        <Img src={staticFile("logo.jpg")} width={132} height={132} style={{ borderRadius: 26, objectFit: "cover", boxShadow: "0 0 50px rgba(34,197,94,.35)" }} />
        <span style={{ fontSize: 112, fontWeight: 700, letterSpacing: "-0.03em", color: "#fff" }}>FlipSync</span>
        <Badge variant="secondary" className="font-mono uppercase tracking-wider" style={{ fontSize: 24, padding: "6px 16px" }}>Beta</Badge>
      </div>
      <div style={{ ...rise(t, 0.35), marginTop: 36, fontSize: 60, fontWeight: 700, letterSpacing: "-0.03em" }}>
        <span className="bg-gradient-to-r from-success via-emerald-400 to-cyan-400 bg-clip-text text-transparent">Every flip, tracked.</span>
      </div>
      <div style={{ ...rise(t, 0.6), marginTop: 56, transform: `${rise(t, 0.6).transform} scale(2.6)` }}>
        <Button size="lg" className="px-8 text-base">Apply for Beta Access<ChevronRight className="ml-2 h-5 w-5" /></Button>
      </div>
      <div className="text-muted-foreground" style={{ ...rise(t, 0.8), marginTop: 76, display: "flex", alignItems: "center", gap: 12, fontSize: 30 }}>
        <Shield style={{ width: 30, height: 30 }} />Free during beta. No credit card required.
      </div>
      <div className="font-mono text-success" style={{ ...rise(t, 0.95), marginTop: 26, fontSize: 38, fontWeight: 600 }}>rs3-flip-tracker.vercel.app</div>
    </AbsoluteFill>
  </AbsoluteFill>
);
