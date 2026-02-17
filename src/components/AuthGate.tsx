"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Mail, ArrowLeft } from "lucide-react";

type Mode = "signin" | "signup";
type View = "form" | "verify-email";

export default function AuthGate({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = React.useState<Mode>("signin");
  const [view, setView] = React.useState<View>("form");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email_confirmed_at) onAuthed();
    });
    return () => data.subscription.unsubscribe();
  }, [onAuthed]);

  const canSubmit = email.trim().length > 3 && password.length >= 6;

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
      if (data.session?.user?.email_confirmed_at) {
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

  // ── Verify email view ──
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

  // ── Sign in / Sign up form ──
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
          <div className="rounded-2xl bg-muted p-1 inline-flex">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={cn(
                "px-4 py-2 rounded-2xl text-sm font-semibold transition",
                mode === "signin" ? "bg-background shadow" : "text-muted-foreground"
              )}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={cn(
                "px-4 py-2 rounded-2xl text-sm font-semibold transition",
                mode === "signup" ? "bg-background shadow" : "text-muted-foreground"
              )}
            >
              Sign up
            </button>
          </div>

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

          {msg && (
            <p className="text-sm text-muted-foreground">{msg}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
