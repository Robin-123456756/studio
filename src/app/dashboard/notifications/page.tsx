import NotificationSender from "@/components/notifications/notification-sender";

export default function NotificationsPage() {
  return (
    <div className="animate-in fade-in-50">
      <div className="mb-6">
        <h2 className="text-2xl font-headline font-semibold">Smart Notification Tester</h2>
        <p className="text-muted-foreground">Test how the AI determines notification relevance based on user roles.</p>
      </div>
      <NotificationSender />
    </div>
  );
}
