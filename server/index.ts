import { setupVite, serveStatic } from "./vite";
import { createApp } from "./app";
import { log } from "./log";

(async () => {
  const { app, server } = await createApp();

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    // macOS rejects SO_REUSEPORT on listen with ENOTSUP, so `npm run dev` cannot start there
    // at all. Deploy targets are Linux and keep the original behaviour.
    reusePort: process.platform !== "darwin",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
