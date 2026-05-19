import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, Request, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { z } from "zod";

const getOidcConfig = memoize(
  async () => {
    if (!process.env.REPL_ID) {
      throw new Error("REPL_ID is required for Replit OIDC");
    }

    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
  user.authProvider = "replit";
}

async function upsertReplitUser(
  claims: any,
): Promise<{ id: string }> {
  const user = await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
  return { id: user.id };
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function getOAuthRedirectUri(req: Request, path: string) {
  const forwardedProto = req.get("x-forwarded-proto");
  const protocol = forwardedProto?.split(",")[0] ?? req.protocol;
  return `${protocol}://${req.hostname}${path}`;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const replitAuthEnabled = !!process.env.REPL_ID;
  const config = replitAuthEnabled ? await getOidcConfig() : null;

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user: any = {};
    updateUserSession(user, tokens);
    const dbUser = await upsertReplitUser(tokens.claims());
    user.claims.sub = dbUser.id;
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (domain: string) => {
    if (!config) {
      throw new Error("Replit OIDC is not configured");
    }

    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  // ──── Replit OAuth routes ────
  if (config) {
    app.get("/api/login", (req, res, next) => {
      ensureStrategy(req.hostname);
      passport.authenticate(`replitauth:${req.hostname}`, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    });

    app.get("/api/callback", (req, res, next) => {
      ensureStrategy(req.hostname);
      passport.authenticate(`replitauth:${req.hostname}`, {
        successReturnToOrRedirect: "/",
        failureRedirect: "/api/login",
      })(req, res, next);
    });
  }

  app.get("/api/logout", (req, res) => {
    const user = req.user as any;
    const isReplitUser = config && user?.authProvider === "replit" && user?.claims;
    
    req.logout(() => {
      if (isReplitUser) {
        try {
          res.redirect(
            client.buildEndSessionUrl(config, {
              client_id: process.env.REPL_ID!,
              post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
            }).href
          );
        } catch {
          res.redirect("/");
        }
      } else {
        res.redirect("/");
      }
    });
  });

  app.post("/api/logout", (req, res) => {
    req.logout(() => {
      res.json({ success: true });
    });
  });

  // ──── Email/Password Registration ────
  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { email, password, firstName, lastName } = parsed.data;

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "An account with this email already exists. Try signing in instead." });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const user = await storage.upsertUser({
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        password: hashedPassword,
        authProvider: "email",
      } as any);

      const sessionUser: any = {
        claims: { sub: user.id },
        authProvider: "email",
        expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      };

      req.login(sessionUser, (err) => {
        if (err) {
          return res.status(500).json({ message: "Registration succeeded but login failed" });
        }
        res.json({ success: true, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // ──── Email/Password Login ────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { email, password } = parsed.data;

      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const sessionUser: any = {
        claims: { sub: user.id },
        authProvider: "email",
        expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      };

      req.login(sessionUser, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed" });
        }
        res.json({ success: true, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // ──── Discord OAuth ────
  const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

  if (DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET) {
    app.get("/api/auth/discord", (req, res) => {
      const redirectUri = `https://${req.hostname}/api/auth/discord/callback`;
      const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "identify email",
      });
      res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
    });

    app.get("/api/auth/discord/callback", async (req, res) => {
      try {
        const { code } = req.query;
        if (!code || typeof code !== "string") {
          return res.redirect("/?error=discord_auth_failed");
        }

        const redirectUri = `https://${req.hostname}/api/auth/discord/callback`;

        const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
          }),
        });

        if (!tokenResponse.ok) {
          console.error("Discord token exchange failed:", await tokenResponse.text());
          return res.redirect("/?error=discord_auth_failed");
        }

        const tokens = await tokenResponse.json();

        const userResponse = await fetch("https://discord.com/api/users/@me", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });

        if (!userResponse.ok) {
          return res.redirect("/?error=discord_auth_failed");
        }

        const discordUser = await userResponse.json() as any;

        let user = await storage.getUserByDiscordId(discordUser.id);

        if (!user) {
          if (discordUser.email) {
            const existingByEmail = await storage.getUserByEmail(discordUser.email);
            if (existingByEmail) {
              await storage.linkDiscordId(existingByEmail.id, discordUser.id);
              user = existingByEmail;
            }
          }
        }

        if (!user) {
          user = await storage.upsertUser({
            email: discordUser.email || null,
            firstName: discordUser.global_name || discordUser.username,
            lastName: null,
            profileImageUrl: discordUser.avatar
              ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
              : null,
            discordId: discordUser.id,
            authProvider: "discord",
          } as any);
        }

        const sessionUser: any = {
          claims: { sub: user.id },
          authProvider: "discord",
          expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
        };

        req.login(sessionUser, (err) => {
          if (err) {
            console.error("Discord login session error:", err);
            return res.redirect("/?error=discord_auth_failed");
          }
          res.redirect("/");
        });
      } catch (error) {
        console.error("Discord auth error:", error);
        res.redirect("/?error=discord_auth_failed");
      }
    });
  }

  // ──── Google OAuth ────
  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    app.get("/api/auth/google", (req, res) => {
      const redirectUri = getOAuthRedirectUri(req, "/api/auth/google/callback");
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        access_type: "online",
      });
      res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    });

    app.get("/api/auth/google/callback", async (req, res) => {
      try {
        const { code } = req.query;
        if (!code || typeof code !== "string") {
          return res.redirect("/?error=google_auth_failed");
        }

        const redirectUri = getOAuthRedirectUri(req, "/api/auth/google/callback");

        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
          }),
        });

        if (!tokenResponse.ok) {
          console.error("Google token exchange failed:", await tokenResponse.text());
          return res.redirect("/?error=google_auth_failed");
        }

        const tokens = await tokenResponse.json() as { access_token?: string };
        if (!tokens.access_token) {
          return res.redirect("/?error=google_auth_failed");
        }

        const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });

        if (!userResponse.ok) {
          console.error("Google userinfo failed:", await userResponse.text());
          return res.redirect("/?error=google_auth_failed");
        }

        const googleUser = await userResponse.json() as {
          email?: string;
          email_verified?: boolean;
          given_name?: string;
          family_name?: string;
          name?: string;
          picture?: string;
        };

        if (!googleUser.email || googleUser.email_verified === false) {
          return res.redirect("/?error=google_email_unverified");
        }

        let user = await storage.getUserByEmail(googleUser.email);

        if (user) {
          user = await storage.updateUserProfile(user.id, {
            firstName: googleUser.given_name || googleUser.name || user.firstName || undefined,
            lastName: googleUser.family_name || user.lastName || undefined,
            profileImageUrl: googleUser.picture || user.profileImageUrl || undefined,
          }) ?? user;
        } else {
          user = await storage.upsertUser({
            email: googleUser.email,
            firstName: googleUser.given_name || googleUser.name || null,
            lastName: googleUser.family_name || null,
            profileImageUrl: googleUser.picture || null,
            authProvider: "google",
          } as any);
        }

        const sessionUser: any = {
          claims: { sub: user.id },
          authProvider: "google",
          expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
        };

        req.login(sessionUser, (err) => {
          if (err) {
            console.error("Google login session error:", err);
            return res.redirect("/?error=google_auth_failed");
          }
          res.redirect("/");
        });
      } catch (error) {
        console.error("Google auth error:", error);
        res.redirect("/?error=google_auth_failed");
      }
    });
  }

  app.get("/api/auth/providers", (_req, res) => {
    res.json({
      replit: replitAuthEnabled,
      email: true,
      discord: !!(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET),
      google: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);

  if (user.authProvider === "email" || user.authProvider === "discord" || user.authProvider === "google") {
    if (now <= user.expires_at) {
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
