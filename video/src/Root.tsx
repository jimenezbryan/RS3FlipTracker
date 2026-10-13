import React from "react";
import { Composition } from "remotion";
import "../../client/src/index.css";
import { Demo } from "./Demo";
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./timeline";

export const Root: React.FC = () => (
  <Composition id="Demo" component={Demo} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
);
