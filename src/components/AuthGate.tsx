"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";

type Mode = "signin" | "signup";
const REDIRECT_TO = "https://studio1-hazel.vercel.app/dashboard/fantasy";

export default function AuthGate({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = React.useState<Mode>("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) onAuthed();
    });
    return () => data.subscription.unsubscribe();
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
          options: { emailRedirectTo: REDIRECT_TO },
        });
        if (error) throw error;

        const needsConfirm = !data.session;
        setMsg(
          needsConfirm
            ? "Account created ✅ Check your email to confirm, then sign in."
            : "Account created ✅ You're signed in."
        );

        if (!needsConfirm) onAuthed();
        else setMode("signin");
        return;
      }

      // ✅ SIGN IN (NOT signUp)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: e1,
        password,
      });
      if (error) throw error;

      if (data.session?.user) onAuthed();
    } catch (err: any) {
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
        options: { emailRedirectTo: REDIRECT_TO },
      });
      if (error) throw error;
      setMsg("Confirmation email resent ✅ Check spam/promotions too.");
    } catch (err: any) {
      setMsg(err?.message ?? "Failed to resend confirmation email");
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
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>Budo League Fantasy</h1>
      <p style={{ opacity: 0.7, marginTop: 6 }}>
        Sign in to pick your team, make transfers, and compete on the leaderboard.
      </p>

      {/* ✅ THIS is the missing part if you only see Sign In */}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button
          type="button"
          onClick={() => setMode("signin")}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: mode === "signin" ? "#111" : "#fff",
            color: mode === "signin" ? "#fff" : "#111",
            fontWeight: 700,
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid #ddd",
            background: mode === "signup" ? "#111" : "#fff",
            color: mode === "signup" ? "#fff" : "#111",
            fontWeight: 700,
          }}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ marginTop: 14, display: "grid", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Email</div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
            }}
          />
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Password</div>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
            }}
          />
        </div>

        <button
          disabled={loading || !canSubmit}
          type="submit"
          style={{
            width: "100%",
            padding: "12px 12px",
            borderRadius: 12,
            border: "none",
            background: "#2563eb",
            color: "white",
            fontWeight: 800,
            opacity: loading || !canSubmit ? 0.6 : 1,
          }}
        >
          {loading ? "..." : mode === "signup" ? "Create account" : "Sign in"}
        </button>

        {showResend ? (
          <button
            type="button"
            onClick={resendConfirmation}
            disabled={loading || !email.trim()}
            style={{
              width: "100%",
              padding: "12px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "white",
              fontWeight: 800,
              opacity: loading || !email.trim() ? 0.6 : 1,
            }}
          >
            Resend confirmation email
          </button>
        ) : null}
      </form>

      {msg ? <p style={{ marginTop: 12, opacity: 0.75 }}>{msg}</p> : null}
    </div>
  );
}
