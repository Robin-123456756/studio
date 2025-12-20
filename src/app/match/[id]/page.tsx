import { notFound } from "next/navigation";
import { recentScores, schedule } from "@/lib/data";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function MatchPage({ params }: Props) {
  const { id } = await params;

  const allGames = [...recentScores, ...schedule];
  const game = allGames.find((g) => g.id === id);
  if (!game) return notFound();

  const dateStr = new Date(game.date).toLocaleDateString(undefined, {
    weekday: "long",
  });

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-muted-foreground">
          ← Back
        </Link>
        <h2 className="text-xl font-semibold">Match Centre</h2>
        <div className="text-sm text-muted-foreground">Share</div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-right mr-2">
                <div className="font-medium">{game.team1.name}</div>
              </div>
              <Image
                src={game.team1.logoUrl}
                alt={game.team1.name}
                width={56}
                height={56}
                className="rounded-full"
              />
            </div>

            <div className="text-center">
              <div className="text-4xl font-bold font-headline">
                {game.score1 ?? "-"} – {game.score2 ?? "-"}
              </div>
              <Badge variant="secondary" className="mt-2">
                {game.status === "completed" ? "FT" : game.status}
              </Badge>
              <div className="text-sm text-muted-foreground mt-2">
                {dateStr} • {game.time} • {game.venue}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Image
                src={game.team2.logoUrl}
                alt={game.team2.name}
                width={56}
                height={56}
                className="rounded-full"
              />
              <div className="ml-2">
                <div className="font-medium">{game.team2.name}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button variant="ghost">Lineups</Button>
        <Button variant="ghost">Stats</Button>
        <Button>Report</Button>
      </div>

      <Card>
        <CardContent>
          <h3 className="text-lg font-semibold">Match Report</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            This is a short match report for {game.team1.name} vs{" "}
            {game.team2.name}. Replace this with admin/editor text content.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent>
            <h4 className="font-semibold">Timeline</h4>
            <p className="text-sm text-muted-foreground mt-2">
              No timeline events for this match yet.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <h4 className="font-semibold">Man of the Match</h4>
            <p className="text-sm text-muted-foreground mt-2">Not selected.</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <Link href="/dashboard/scores" className="text-sm text-primary hover:underline">
          Back to Results
        </Link>
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
          View Table
        </Link>
      </div>
    </div>
  );
}
