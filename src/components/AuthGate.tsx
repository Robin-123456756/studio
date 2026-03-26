"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Mail, ArrowLeft, Phone } from "lucide-react";

type Mode = "signin" | "signup";
type View = "form" | "verify-email" | "forgot-password" | "phone" | "verify-otp";

// ── SVG brand icons ──────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.912-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"
        fill="#25D366"
      />
      <path
        d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.243-1.214l-.307-.184-2.87.853.853-2.87-.184-.307A8 8 0 1112 20z"
        fill="#25D366"
      />
    </svg>
  );
}


// ── OAuth button ─────────────────────────────────────────────────────────

type Provider = "google" | "twitter";

function SocialButton({
  label,
  icon,
  onClick,
  loading,
}: {
  provider: Provider;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-semibold transition",
        "bg-background hover:bg-muted active:scale-[0.98]",
        "disabled:opacity-50 disabled:cursor-not-allowed"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ── Divider ──────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 border-t" />
      <span className="text-xs font-medium text-muted-foreground">or</span>
      <div className="flex-1 border-t" />
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export default function AuthGate({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = React.useState<Mode>("signin");
  const [view, setView] = React.useState<View>("form");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [oauthLoading, setOauthLoading] = React.useState<Provider | null>(null);
  const [phoneNumber, setPhoneNumber] = React.useState("+256");
  const [otpCode, setOtpCode] = React.useState("");
  const [otpChannel, setOtpChannel] = React.useState<"sms" | "whatsapp">("whatsapp");

  React.useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      if (u?.email_confirmed_at || u?.phone_confirmed_at || u?.phone) onAuthed();
    });
    return () => data.subscription.unsubscribe();
  }, [onAuthed]);

  const canSubmit = email.trim().length > 3 && password.length >= 6;

  // ── OAuth sign-in ──
  async function signInWithOAuth(provider: Provider) {
    setOauthLoading(provider);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      // Browser redirects to provider — no further action needed here
    } catch (err: any) {
      setMsg(err?.message ?? `${provider} sign-in failed`);
      setOauthLoading(null);
    }
  }

  // ── Email / password submit ──
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;

        // Email confirmation is ON — show verification screen
        setView("verify-email");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          if (error.message.toLowerCase().includes("email not confirmed")) {
            setView("verify-email");
            setMsg("Your email is not verified yet. Check your inbox or resend the link below.");
            return;
          }
          throw error;
        }

        if (data.session?.user) {
          if (!data.session.user.email_confirmed_at) {
            setView("verify-email");
            setMsg("Please verify your email before continuing.");
            return;
          }
          onAuthed();
        }
      }
    } catch (err: any) {
      setMsg(err?.message ?? "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    if (!email.trim()) {
      setMsg("Enter your email address above first.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setMsg("Verification email sent! Check your inbox (and spam folder).");
    } catch (err: any) {
      const m = err?.message ?? "Failed to resend";
      if (m.toLowerCase().includes("rate") || m.toLowerCase().includes("limit")) {
        setMsg("Too many requests — wait 60 seconds and try again.");
      } else {
        setMsg(m);
      }
    } finally {
      setLoading(false);
    }
  }

  async function recheckVerification() {
    setLoading(true);
    setMsg(null);
    try {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (u?.email_confirmed_at || u?.phone_confirmed_at || u?.phone) {
        onAuthed();
      } else {
        setMsg("Email not verified yet. Check your inbox and click the link.");
      }
    } catch {
      setMsg("Could not check verification status.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setMsg("Enter your email address above first.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      });
      if (error) throw error;
      setMsg("Password reset link sent! Check your inbox (and spam folder).");
    } catch (err: any) {
      const m = err?.message ?? "Failed to send reset link";
      if (m.toLowerCase().includes("rate") || m.toLowerCase().includes("limit")) {
        setMsg("Too many requests — wait 60 seconds and try again.");
      } else {
        setMsg(m);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Phone OTP ──
  async function sendPhoneOtp() {
    const phone = phoneNumber.trim();
    if (!phone || phone.length < 10) {
      setMsg("Enter a valid phone number (e.g. +256 7XX XXX XXX).");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: { channel: otpChannel },
      });
      if (error) throw error;
      setView("verify-otp");
      setMsg(`Code sent via ${otpChannel === "whatsapp" ? "WhatsApp" : "SMS"} to ${phone}`);
    } catch (err: any) {
      const m = err?.message ?? "Failed to send code";
      if (m.toLowerCase().includes("rate") || m.toLowerCase().includes("limit")) {
        setMsg("Too many requests — wait 60 seconds and try again.");
      } else {
        setMsg(m);
      }
    } finally {
      setLoading(false);
    }
  }

  async function verifyPhoneOtp() {
    if (otpCode.length !== 6) {
      setMsg("Enter the 6-digit code.");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: phoneNumber.trim(),
        token: otpCode,
        type: "sms",
      });
      if (error) throw error;
      if (data.session?.user) {
        onAuthed();
      }
    } catch (err: any) {
      setMsg(err?.message ?? "Verification failed. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Forgot password view ──────────────────────────────────────────────
  if (view === "forgot-password") {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-10 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold">Budo League Fantasy</h1>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-6 space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-lg font-bold">Reset your password</h2>
            <p className="text-sm text-muted-foreground">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>

            <input
              className="w-full border rounded-xl px-3 py-2 bg-background text-center"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoFocus
            />

            {msg && (
              <p className="text-sm text-muted-foreground">{msg}</p>
            )}

            <Button
              className="w-full rounded-2xl"
              onClick={handleForgotPassword}
              disabled={loading || !email.trim()}
            >
              {loading ? "Sending..." : "Send reset link"}
            </Button>

            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { setView("form"); setMsg(null); }}
            >
              <ArrowLeft className="inline h-3 w-3 mr-1" />
              Back to sign in
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Verify email view ─────────────────────────────────────────────────
  if (view === "verify-email") {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-10 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold">Budo League Fantasy</h1>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-6 space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-lg font-bold">Check your email</h2>
            <p className="text-sm text-muted-foreground">
              {email
                ? <>We sent a verification link to <strong className="text-foreground">{email}</strong>. Click the link to verify your account and start playing.</>
                : <>Enter your email below and resend the verification link.</>
              }
            </p>

            <input
              className="w-full border rounded-xl px-3 py-2 bg-background text-center"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
            />

            {msg && (
              <p className="text-sm text-muted-foreground">{msg}</p>
            )}

            <div className="space-y-2">
              <Button
                className="w-full rounded-2xl"
                onClick={recheckVerification}
                disabled={loading}
              >
                {loading ? "Checking..." : "I've verified my email"}
              </Button>

              <Button
                variant="outline"
                className="w-full rounded-2xl"
                onClick={resendVerification}
                disabled={loading || !email.trim()}
              >
                Resend verification email
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Check your spam/junk folder. Emails may take up to a minute to arrive.
            </p>

            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { setView("form"); setMsg(null); }}
            >
              <ArrowLeft className="inline h-3 w-3 mr-1" />
              Back to sign in
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Phone number input view ──────────────────────────────────────────
  if (view === "phone") {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-10 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold">Budo League Fantasy</h1>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-6 space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Phone className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-lg font-bold">Sign in with phone</h2>
            <p className="text-sm text-muted-foreground">
              We&apos;ll send you a 6-digit code via {otpChannel === "whatsapp" ? "WhatsApp" : "SMS"}.
            </p>

            <input
              className="w-full border rounded-xl px-3 py-2 bg-background text-center text-lg tracking-wider"
              placeholder="+256 7XX XXX XXX"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              type="tel"
              autoComplete="tel"
              autoFocus
            />

            {/* Channel toggle */}
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setOtpChannel("whatsapp")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold transition",
                  otpChannel === "whatsapp"
                    ? "bg-[#25D366]/10 text-[#25D366] ring-1 ring-[#25D366]/30"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setOtpChannel("sms")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold transition",
                  otpChannel === "sms"
                    ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                SMS
              </button>
            </div>

            {msg && (
              <p className="text-sm text-muted-foreground">{msg}</p>
            )}

            <Button
              className="w-full rounded-2xl"
              onClick={sendPhoneOtp}
              disabled={loading || phoneNumber.trim().length < 10}
            >
              {loading ? "Sending..." : "Send code"}
            </Button>

            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { setView("form"); setMsg(null); }}
            >
              <ArrowLeft className="inline h-3 w-3 mr-1" />
              Back to sign in
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── OTP verification view ──────────────────────────────────────────────
  if (view === "verify-otp") {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-10 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold">Budo League Fantasy</h1>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-6 space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Phone className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-lg font-bold">Enter verification code</h2>
            <p className="text-sm text-muted-foreground">
              We sent a 6-digit code to <strong className="text-foreground">{phoneNumber}</strong> via {otpChannel === "whatsapp" ? "WhatsApp" : "SMS"}.
            </p>

            <input
              className="w-full border rounded-xl px-3 py-3 bg-background text-center text-2xl tracking-[0.5em] font-mono"
              placeholder="000000"
              value={otpCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setOtpCode(val);
              }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
            />

            {msg && (
              <p className="text-sm text-muted-foreground">{msg}</p>
            )}

            <div className="space-y-2">
              <Button
                className="w-full rounded-2xl"
                onClick={verifyPhoneOtp}
                disabled={loading || otpCode.length !== 6}
              >
                {loading ? "Verifying..." : "Verify & sign in"}
              </Button>

              <Button
                variant="outline"
                className="w-full rounded-2xl"
                onClick={() => {
                  setOtpCode("");
                  sendPhoneOtp();
                }}
                disabled={loading}
              >
                Resend code
              </Button>
            </div>

            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { setView("phone"); setMsg(null); setOtpCode(""); }}
            >
              <ArrowLeft className="inline h-3 w-3 mr-1" />
              Change phone number
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Sign in / Sign up form ────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-10 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold">Budo League Fantasy</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to pick your team, make transfers, and compete on the leaderboard.
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-4 space-y-4">
          {/* Mode toggle */}
          <div className="rounded-2xl bg-muted p-1 inline-flex">
            <button
              type="button"
              onClick={() => { setMode("signin"); setMsg(null); }}
              className={cn(
                "px-4 py-2 rounded-2xl text-sm font-semibold transition",
                mode === "signin" ? "bg-background shadow" : "text-muted-foreground"
              )}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setMsg(null); }}
              className={cn(
                "px-4 py-2 rounded-2xl text-sm font-semibold transition",
                mode === "signup" ? "bg-background shadow" : "text-muted-foreground"
              )}
            >
              Sign up
            </button>
          </div>

          {/* Social login buttons */}
          <div className="space-y-2">
            <SocialButton
              provider="google"
              label="Continue with Google"
              icon={<GoogleIcon />}
              onClick={() => signInWithOAuth("google")}
              loading={oauthLoading === "google"}
            />
            <SocialButton
              provider="twitter"
              label="Continue with X (Twitter)"
              icon={<XIcon />}
              onClick={() => signInWithOAuth("twitter")}
              loading={oauthLoading === "twitter"}
            />
            <button
              type="button"
              onClick={() => { setView("phone"); setMsg(null); }}
              className={cn(
                "flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-semibold transition",
                "bg-background hover:bg-muted active:scale-[0.98]"
              )}
            >
              <WhatsAppIcon />
              <span>Continue with Phone / WhatsApp</span>
            </button>
          </div>

          <Divider />

          {/* Email / password form */}
          <form onSubmit={onSubmit} className="space-y-3">
            <input
              className="w-full border rounded-xl px-3 py-2 bg-background"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
            />

            <input
              className="w-full border rounded-xl px-3 py-2 bg-background"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
            />

            <Button className="w-full rounded-2xl" disabled={loading || !canSubmit} type="submit">
              {loading ? "..." : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          {mode === "signin" && (
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { setView("forgot-password"); setMsg(null); }}
            >
              Forgot password?
            </button>
          )}

          {msg && (
            <p className="text-sm text-muted-foreground">{msg}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
