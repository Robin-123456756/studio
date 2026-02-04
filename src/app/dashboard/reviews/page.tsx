"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";

export default function ReviewsPage() {
  const [message, setMessage] = React.useState("");
  const [rating, setRating] = React.useState<number | null>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  const [userId, setUserId] = React.useState<string | null>(null);

  React.useEffect(() => {
    // if logged in, attach userId (optional)
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });
  }, []);

  async function submit() {
    setMsg(null);

    const text = message.trim();
    if (text.length < 5) return setMsg("Please write a bit more feedback.");

    try {
      setSending(true);

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          rating,
          name: name.trim() || null,
          email: email.trim() || null,
          userId,
          page: "More > Reviews",
          device: typeof window !== "undefined" && window.innerWidth < 768 ? "mobile" : "desktop",
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to send");

      setMessage("");
      setRating(null);
      setName("");
      setEmail("");
      setMsg("Thanks ✅ Your feedback was sent.");
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to send feedback");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-extrabold tracking-tight">Reviews</div>
          <div className="text-sm text-muted-foreground">
            Send your opinion / feedback to the admin.
          </div>
        </div>

        <Button asChild variant="outline" className="rounded-2xl">
          <Link href="/dashboard/more">Back</Link>
        </Button>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-4 space-y-3">
          {!userId ? (
            <div className="text-xs text-muted-foreground">
              Optional: add your name/email so admin can reply.
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              Signed in ✅ (feedback will include your user id)
            </div>
          )}

          {!userId ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional)"
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              />
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Rating (optional)</div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={cn(
                    "h-9 w-9 rounded-full border text-sm font-bold",
                    rating === n ? "bg-foreground text-background" : "bg-background"
                  )}
                  aria-label={`Rate ${n}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your feedback…"
            className="min-h-[140px] w-full rounded-2xl border bg-background px-3 py-3 text-sm"
          />

          {msg ? <div className="text-sm">{msg}</div> : null}

          <Button className="w-full rounded-2xl" onClick={submit} disabled={sending}>
            {sending ? "Sending..." : "Send Feedback"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
