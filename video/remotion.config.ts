import path from "path";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);

// The video imports the app's own UI primitives, theme and shared logic, so it needs the same
// path aliases as the app (see ../vite.config.ts) and has to resolve their packages from here.
Config.overrideWebpackConfig((config) => {
  const withTailwind = enableTailwind(config);
  return {
    ...withTailwind,
    resolve: {
      ...withTailwind.resolve,
      alias: {
        ...(withTailwind.resolve?.alias ?? {}),
        "@": path.resolve(process.cwd(), "../client/src"),
        "@shared": path.resolve(process.cwd(), "../shared"),
        "@assets": path.resolve(process.cwd(), "../attached_assets"),
      },
      modules: [path.resolve(process.cwd(), "node_modules"), "node_modules"],
    },
  };
});
