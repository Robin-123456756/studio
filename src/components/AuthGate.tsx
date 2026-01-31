"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

const REDIRECT_TO = "https://studio1-hazel.vercel.app/dashboard/fantasy";

export default function AuthGate({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = React.useState<Mode>("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Optional: auto-continue when auth state becomes signed in
  React.useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) onAuthed();
    });
    return () => sub.subscription.unsubscribe();
  }, [onAuthed]);

  const canSubmit = email.trim().length > 3 && password.length >= 6;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setMsg(null);

    try {
      const e1 = email.trim();

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: e1,
          password,
          options: {
            emailRedirectTo: REDIRECT_TO,
          },
        });
        if (error) throw error;

        // If email confirmation is ON, session is null until they confirm
        const needsConfirm = !data.session;

        setMsg(
          needsConfirm
            ? "Account created ✅ Check your email to confirm, then come back and sign in."
            : "Account created ✅ You're signed in."
        );

        if (!needsConfirm) onAuthed();
        else setMode("signin");
        return;
      }

      // ✅ SIGN IN
      const { data, error } = await supabase.auth.signInWithPassword({
        email: e1,
        password,
      });
      if (error) throw error;

      if (data?.session?.user) {
        setMsg(null);
        onAuthed();
      } else {
        setMsg("Signed in, but no session found. Try again.");
      }
    } catch (err: any) {
      const m = err?.message ?? "Auth failed";

      // Friendly message for common Supabase case
      if (m.toLowerCase().includes("email not confirmed")) {
        setMsg("Email not confirmed. Tap 'Resend confirmation email' then confirm and sign in.");
      } else {
        setMsg(m);
      }} finally {
        setLoading(false);
      }
    }
    return (
      <Card className ={cn('w-full max-w-sm mx-auto')}>
        <CardContent className="p-6">
          {msg && <p className="text-sm text-red-500 mb-4">{msg}</p>}
          <form onSubmit={onSubmit}>
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <Button type="submit" disabled={loading || !canSubmit} className="w-full">
              {loading ? "Loading..." : mode === "signin" ? "Sign In" : "Sign Up"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }