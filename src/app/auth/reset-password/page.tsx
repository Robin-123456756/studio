"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Lock, CheckCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const isValid = password.length >= 6 && password === confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || loading) return;

    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      setMsg(err?.message ?? "Failed to update password");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-start justify-center">
        <div className="mx-auto w-full max-w-md px-4 pt-10 space-y-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold">Budo League Fantasy</h1>
          </div>
          <Card className="overflow-hidden">
            <CardContent className="p-6 space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle className="h-7 w-7 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold">Password updated</h2>
              <p className="text-sm text-muted-foreground">
                Your password has been changed successfully.
              </p>
              <Button
                className="w-full rounded-2xl"
                onClick={() => router.push("/dashboard/fantasy")}
              >
                Go to Fantasy
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-start justify-center">
      <div className="mx-auto w-full max-w-md px-4 pt-10 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold">Budo League Fantasy</h1>
        </div>
        <Card className="overflow-hidden">
          <CardContent className="p-6 space-y-4">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Lock className="h-7 w-7 text-primary" />
              </div>
              <h2 className="mt-3 text-lg font-bold">Set new password</h2>
              <p className="text-sm text-muted-foreground">
                Enter your new password below.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                className="w-full border rounded-xl px-3 py-2 bg-background"
                placeholder="New password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                autoFocus
                required
              />
              <input
                className="w-full border rounded-xl px-3 py-2 bg-background"
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type="password"
                autoComplete="new-password"
                required
              />

              {password.length > 0 && password.length < 6 && (
                <p className="text-xs text-red-500">Password must be at least 6 characters</p>
              )}
              {confirm.length > 0 && password !== confirm && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
              {msg && <p className="text-xs text-red-500">{msg}</p>}

              <Button
                className="w-full rounded-2xl"
                disabled={!isValid || loading}
                type="submit"
              >
                {loading ? "Updating..." : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
