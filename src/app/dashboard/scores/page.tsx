import { recentScores, standings } from "@/lib/data";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function ScoresPage() {
  return (
    <div className="animate-in fade-in-50">
      <Tabs defaultValue="scores" className="w-full">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-headline font-semibold">Scores & Standings</h2>
          <TabsList>
            <TabsTrigger value="scores">Recent Scores</TabsTrigger>
            <TabsTrigger value="standings">Standings</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="scores" className="mt-6">
          <div className="space-y-4">
            {recentScores.map(game => (
              <Link key={game.id} href={`/match/${game.id}`} className="block">
                <Card className="transition-shadow hover:shadow-lg">
                  <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4 md:gap-8 flex-1">
                    <div className="flex flex-col items-end gap-2 text-right flex-1">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="hidden sm:inline font-medium">{game.team1.name}</span>
                        <Image src={game.team1.logoUrl} alt={game.team1.name} width={32} height={32} className="rounded-full" data-ai-hint="team logo" />
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl sm:text-3xl font-bold font-headline">{game.score1} - {game.score2}</div>
                      <Badge variant="secondary" className="capitalize mt-1">{game.status}</Badge>
                    </div>
                    <div className="flex items-center gap-4 md:gap-8 flex-1">
                      <div className="flex items-center gap-2">
                        <Image src={game.team2.logoUrl} alt={game.team2.name} width={32} height={32} className="rounded-full" data-ai-hint="team logo" />
                        <span className="hidden sm:inline font-medium">{game.team2.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground w-28 hidden md:block">
                    <div>{new Date(game.date).toLocaleDateString()}</div>
                    <div>{game.venue}</div>
                  </div>
                </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="standings" className="mt-6">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-center">W</TableHead>
                  <TableHead className="text-center">L</TableHead>
                  <TableHead className="text-center">D</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {standings.map((team, index) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Image src={team.logoUrl} alt={team.name} width={24} height={24} className="rounded-full" data-ai-hint="team logo" />
                        <span className="font-medium">{team.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono">{team.wins}</TableCell>
                    <TableCell className="text-center font-mono">{team.losses}</TableCell>
                    <TableCell className="text-center font-mono">{team.draws}</TableCell>
                    <TableCell className="text-right font-bold font-mono">{team.wins * 3 + team.draws}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
