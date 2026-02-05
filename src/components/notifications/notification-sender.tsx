"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, CheckCircle, XCircle, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { checkNotificationRelevance } from "@/app/dashboard/notifications/actions";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  notificationType: z.enum(["game_schedule", "score_update", "rule_change"], {
    required_error: "Please select a type.",
  }),
  userRole: z.enum(["league_admin", "team_member", "coach"], {
    required_error: "Please select a role.",
  }),
  message: z.string().min(10, { message: "Message must be at least 10 characters." }),
});

type FormValues = z.infer<typeof formSchema>;
type RelevanceResult = { relevant: boolean; reason: string } | null;

// Narrow the union safely (works even if actions.ts typing is loose)
function isRelevanceOk(
  r: unknown
): r is { success: true; relevant: boolean; reason: string } {
  if (!r || typeof r !== "object") return false;
  const obj = r as Record<string, unknown>;
  return (
    obj.success === true &&
    typeof obj.relevant === "boolean" &&
    typeof obj.reason === "string"
  );
}

function getErrorMessage(r: unknown): string {
  if (!r || typeof r !== "object") return "Unknown error";
  const obj = r as Record<string, unknown>;
  return typeof obj.error === "string" ? obj.error : "Unknown error";
}

export default function NotificationSender() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RelevanceResult>(null);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      notificationType: "game_schedule",
      userRole: "team_member",
      message:
        "Reminder: The match between Vipers and Dragons is tomorrow at 6 PM at the Main Arena. Please arrive 30 minutes early.",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await checkNotificationRelevance(values);

      if (isRelevanceOk(response)) {
        setResult({ relevant: response.relevant, reason: response.reason });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: getErrorMessage(response),
        });
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>1. Compose Notification</CardTitle>
          <CardDescription>
            Create a notification to test its relevance for a specific user role.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="notificationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notification Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a notification type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="game_schedule">Game Schedule</SelectItem>
                        <SelectItem value="score_update">Score Update</SelectItem>
                        <SelectItem value="rule_change">Rule Change</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="userRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target User Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a user role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="league_admin">League Admin</SelectItem>
                        <SelectItem value="team_member">Team Member</SelectItem>
                        <SelectItem value="coach">Coach</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="E.g., The game against the Dragons has been moved to 8 PM."
                        {...field}
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                Check Relevance
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>2. AI Relevance Check</CardTitle>
          <CardDescription>
            The AI decision on whether to send the notification to the selected role.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-grow flex">
          {isLoading && (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                <p>Checking relevance...</p>
              </div>
            </div>
          )}

          {result && (
            <div className="flex-1 flex items-center justify-center">
              <Alert
                variant={result.relevant ? "default" : "destructive"}
                className={
                  result.relevant
                    ? "bg-green-500/10 border-green-500/50 text-green-300"
                    : ""
                }
              >
                {result.relevant ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {result.relevant ? "Relevant Notification" : "Irrelevant Notification"}
                </AlertTitle>
                <AlertDescription className={result.relevant ? "text-green-300/80" : ""}>
                  {result.reason}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {!isLoading && !result && (
            <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm border-2 border-dashed border-input rounded-lg">
              Result will appear here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
