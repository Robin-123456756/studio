"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

export default function AuthGate({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = React.useState<Mode>("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Optional: if auth state changes (login/logout) update UI / redirect
  React.useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) onAuthed();
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
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;

        // If email confirmation is ON, session will be null until confirmed
        const needsConfirm = !data?.session;

        setMsg(
          needsConfirm
            ? "Account created ✅ Check your email to confirm, then sign in."
            : "Account created ✅ You're signed in."
        );

        if (!needsConfirm) onAuthed();
        else setMode("signin");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;

        if (data?.session?.user) {
          setMsg(null);
          onAuthed();
        } else {
          setMsg("Signed in, but no session found. Try again.");
        }
      }
    } catch (err: any) {
      // Supabase common message: "Email not confirmed"
      const m = err?.message ?? "Auth failed";
      setMsg(m);
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirmation() {
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
      });
      if (error) throw error;

      setMsg("Confirmation email resent ✅ Check spam/promotions too.");
    } catch (err: any) {
      setMsg(err?.message ?? "Failed to resend confirmation email");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setMsg("Signed out.");
    } catch (err: any) {
      setMsg(err?.message ?? "Failed to sign out");
    } finally {
      setLoading(false);
    }
  }

  const showResend =
    mode === "signin" &&
    !!email.trim() &&
    (msg?.toLowerCase().includes("not confirmed") ||
      msg?.toLowerCase().includes("confirm") ||
      msg?.toLowerCase().includes("verification"));

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

            {showResend ? (
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-2xl"
                onClick={resendConfirmation}
                disabled={loading || !email.trim()}
              >
                Resend confirmation email
              </Button>
            ) : null}
          </form>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
            </div>

            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={signOut}
              disabled={loading}
            >
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
