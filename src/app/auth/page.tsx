"use client";

import { useRouter, useSearchParams } from "next/navigation";
import AuthGate from "@/components/AuthGate";

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="min-h-screen bg-background flex items-start justify-center">
      <div className="w-full">
        {error === "verification_failed" && (
          <div className="mx-auto max-w-md mt-6 px-4">
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive text-center">
              Email verification failed or the link has expired. Please try signing in or resend the verification email.
            </div>
          </div>
        )}
        <AuthGate onAuthed={() => router.push("/dashboard/fantasy")} />
      </div>
    </div>
  );
}
