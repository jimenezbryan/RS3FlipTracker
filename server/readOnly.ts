import type { Request, Response, NextFunction } from "express";

// Read-only "moving" mode for the cutover freeze. Set READ_ONLY_MOVING_TO to the new address to
// turn it on; unset it (and redeploy) to roll back. Read per request, so nothing is cached.
const READS = new Set(["GET", "HEAD", "OPTIONS"]);
// Signing in/out only writes a session row, and Users need it to read their data while frozen.
const ALLOWED_WRITES = new Set(["POST /api/auth/login", "POST /api/logout"]);

export function readOnlyGuard(env: Record<string, string | undefined> = process.env) {
  return (req: Request, res: Response, next: NextFunction) => {
    const movingTo = env.READ_ONLY_MOVING_TO;
    if (!movingTo || READS.has(req.method)) return next();
    // 200, not an error: the scheduled job stays green, it just posts nothing to Discord.
    if (req.path === "/api/cron/alerts") return res.json({ skipped: "read-only", movingTo });
    if (ALLOWED_WRITES.has(`${req.method} ${req.path}`)) return next();
    res.status(503).set("Retry-After", "3600").json({
      message: `RS3 Flip Tracker is moving to ${movingTo}. It's read-only until the move is done, so changes can't be saved right now. Your data is safe.`,
    });
  };
}
