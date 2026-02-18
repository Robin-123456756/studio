"use client";

import { useSession } from "next-auth/react";
import NotificationSender from "@/components/notifications/notification-sender";

export default function AdminNotificationsPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }

  if (!session?.user) {
    return (
      <div className="p-8 text-red-500 font-semibold">
        Access denied. Please log in as admin.
      </div>
    );
  }

  return (
    <div className="p-6 animate-in fade-in-50">
      <div className="mb-6">
        <h2 className="text-2xl font-headline font-semibold">
          Smart Notification Tester
        </h2>
        <p className="text-muted-foreground">
          Test how the AI determines notification relevance based on user roles.
        </p>
      </div>
      <NotificationSender />
    </div>
  );
}
