import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GPStackLogo } from "@/components/GPStackLogo";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  Zap,
} from "lucide-react";

type AuthMode = "login" | "register" | "forgot" | "reset";

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.74-.07-1.45-.19-2.14H12v4.05h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.31 2.98-7.44z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.89 6.62-2.33l-3.23-2.51c-.9.6-2.04.95-3.39.95-2.6 0-4.8-1.76-5.59-4.12H3.08v2.59A10 10 0 0 0 12 22z" />
      <path fill="#FBBC05" d="M6.41 13.99A6.01 6.01 0 0 1 6.09 12c0-.69.12-1.36.32-1.99V7.42H3.08A10 10 0 0 0 2 12c0 1.61.39 3.14 1.08 4.58l3.33-2.59z" />
      <path fill="#EA4335" d="M12 5.89c1.47 0 2.78.5 3.82 1.49l2.87-2.87C16.95 2.89 14.69 2 12 2a10 10 0 0 0-8.92 5.42l3.33 2.59C7.2 7.65 9.4 5.89 12 5.89z" />
    </svg>
  );
}

function ReplitIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h6A2.5 2.5 0 0 1 13 2.5v4a2.5 2.5 0 0 1-2.5 2.5H8v5.5a2.5 2.5 0 0 1-2.5 2.5h-1A2.5 2.5 0 0 1 2 14.5v-12zM4.5 2a.5.5 0 0 0-.5.5v4a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-.5-.5h-6zM11 11.5a2.5 2.5 0 0 1 2.5-2.5h6A2.5 2.5 0 0 1 22 11.5v10a2.5 2.5 0 0 1-2.5 2.5h-6a2.5 2.5 0 0 1-2.5-2.5v-10zm2.5-.5a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5v-10a.5.5 0 0 0-.5-.5h-6zM2 16.5A2.5 2.5 0 0 1 4.5 14h1a2.5 2.5 0 0 1 2.5 2.5v5A2.5 2.5 0 0 1 5.5 24h-1A2.5 2.5 0 0 1 2 21.5v-5z" />
    </svg>
  );
}

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setLocation] = useLocation();
  const { refetchUser } = useAuth();
  const { toast } = useToast();

  const { data: providers } = useQuery<{ replit: boolean; email: boolean; discord: boolean; google: boolean }>({
    queryKey: ["/api/auth/providers"],
    placeholderData: { replit: false, email: true, discord: false, google: false },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromQuery = params.get("resetToken");
    if (tokenFromQuery) {
      setResetToken(tokenFromQuery);
      setMode("reset");
    }
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body: any = { email, password };
      if (mode === "register" && firstName) {
        body.firstName = firstName;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: mode === "register" ? "Registration Failed" : "Login Failed",
          description: data.message || "Something went wrong",
          variant: "destructive",
        });
        return;
      }

      await refetchUser();
      setLocation("/");
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResetLink(null);

    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Reset Request Failed",
          description: data.message || "Something went wrong",
          variant: "destructive",
        });
        return;
      }

      if (data.resetUrl) {
        setResetLink(data.resetUrl);
      }

      toast({
        title: "Check your reset instructions",
        description: data.message || "If an account exists, reset instructions were generated.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (password !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Please re-enter both password fields.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, newPassword: password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Reset Failed",
          description: data.message || "Unable to reset password.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Password Updated",
        description: "You can now sign in with your new password.",
      });
      setPassword("");
      setConfirmPassword("");
      setResetToken("");
      setMode("login");
      setLocation("/auth");
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e14] via-[#0f1419] to-[#0a0e14] text-foreground relative flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-success/10 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-blue-500/8 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="mb-6">
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => setLocation("/")}
            data-testid="button-back-landing"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <GPStackLogo size={40} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">
            {mode === "login" && "Welcome back"}
            {mode === "register" && "Create your account"}
            {mode === "forgot" && "Reset your password"}
            {mode === "reset" && "Set a new password"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" && "Sign in to your FlipSync account"}
            {mode === "register" && "Start tracking your RS3 flips"}
            {mode === "forgot" && "Enter your email and we will generate reset instructions."}
            {mode === "reset" && "Create a fresh password for your account."}
          </p>
        </div>

        <Card className="bg-[#131a22]/90 border-border/40 p-6 backdrop-blur-sm">
          <div className="space-y-4">
            {(mode === "login" || mode === "register") && providers?.replit && (
              <div className="space-y-2">
                <Button
                  variant="default"
                  size="lg"
                  className="w-full justify-center gap-3 text-base"
                  asChild
                  data-testid="button-login-replit"
                >
                  <a href="/api/login">
                    <ReplitIcon className="h-5 w-5" />
                    Continue with Replit
                  </a>
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Supports Google, GitHub, Apple & more
                </p>
              </div>
            )}

            {(mode === "login" || mode === "register") && providers?.discord && (
              <Button
                variant="outline"
                className="w-full justify-center gap-3 bg-[#5865F2]/10 border-[#5865F2]/30 text-[#5865F2] backdrop-blur-sm"
                asChild
                data-testid="button-login-discord"
              >
                <a href="/api/auth/discord">
                  <DiscordIcon className="h-5 w-5" />
                  Continue with Discord
                </a>
              </Button>
            )}

            {(mode === "login" || mode === "register") && providers?.google && (
              <Button
                variant="outline"
                className="w-full justify-center gap-3 bg-white/5 border-border/50 text-white backdrop-blur-sm"
                asChild
                data-testid="button-login-google"
              >
                <a href="/api/auth/google">
                  <GoogleIcon className="h-5 w-5" />
                  Continue with Google
                </a>
              </Button>
            )}

            {(mode === "login" || mode === "register") && (providers?.replit || providers?.discord || providers?.google) && providers?.email && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/40" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#131a22] px-3 text-muted-foreground">or</span>
                </div>
              </div>
            )}

            {providers?.email && (mode === "login" || mode === "register") && (
              <form onSubmit={handleEmailAuth} className="space-y-4">
                {mode === "register" && (
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm text-muted-foreground">
                      Display Name
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="firstName"
                        type="text"
                        placeholder="Your display name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="pl-10 bg-background/50 border-border/40"
                        data-testid="input-firstname"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm text-muted-foreground">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 bg-background/50 border-border/40"
                      data-testid="input-email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm text-muted-foreground">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={mode === "register" ? "Min 6 characters" : "Your password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={mode === "register" ? 6 : 1}
                      className="pl-10 pr-10 bg-background/50 border-border/40"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                  data-testid="button-submit-auth"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  {mode === "login" ? "Sign In" : "Create Account"}
                </Button>

                {mode === "login" && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setPassword("");
                      }}
                      className="text-sm text-muted-foreground hover:text-white transition-colors"
                      data-testid="button-forgot-password"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </form>
            )}

            {providers?.email && mode === "forgot" && (
              <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-sm text-muted-foreground">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 bg-background/50 border-border/40"
                      data-testid="input-reset-email"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                  data-testid="button-request-password-reset"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Send Reset Instructions
                </Button>

                {resetLink && (
                  <div className="rounded-md border border-border/40 bg-background/30 p-3 text-xs">
                    <p className="text-muted-foreground mb-2">Reset link:</p>
                    <a
                      href={resetLink}
                      className="break-all text-success hover:underline"
                      data-testid="link-direct-reset-url"
                    >
                      {resetLink}
                    </a>
                  </div>
                )}
              </form>
            )}

            {providers?.email && mode === "reset" && (
              <form onSubmit={handleConfirmPasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-sm text-muted-foreground">
                    New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      required
                      className="pl-10 pr-10 bg-background/50 border-border/40"
                      data-testid="input-new-password"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-sm text-muted-foreground">
                    Confirm New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={6}
                      required
                      className="pl-10 pr-10 bg-background/50 border-border/40"
                      data-testid="input-confirm-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="button-toggle-password-reset"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                  data-testid="button-confirm-password-reset"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Lock className="h-4 w-4 mr-2" />
                  )}
                  Update Password
                </Button>
              </form>
            )}

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  if (mode === "forgot" || mode === "reset") {
                    setMode("login");
                  } else {
                    setMode(mode === "login" ? "register" : "login");
                  }
                  setPassword("");
                  setConfirmPassword("");
                }}
                className="text-sm text-muted-foreground hover:text-white transition-colors"
                data-testid="button-switch-mode"
              >
                {mode === "forgot" || mode === "reset" ? (
                  <>Back to <span className="text-success font-medium">Sign in</span></>
                ) : mode === "login" ? (
                  <>No account yet? <span className="text-success font-medium">Sign up</span></>
                ) : (
                  <>Already have an account? <span className="text-success font-medium">Sign in</span></>
                )}
              </button>
            </div>
          </div>
        </Card>

        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-[10px] font-mono tracking-wider uppercase">Beta</Badge>
            <span>Free during beta period</span>
          </div>
        </div>
      </div>
    </div>
  );
}
