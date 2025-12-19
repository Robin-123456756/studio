import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { teams } from "@/lib/data";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

export default function TeamsPage() {
  return (
    <div className="space-y-6 animate-in fade-in-50">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-headline font-semibold">Teams Roster</h2>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Team
        </Button>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {teams.map((team) => (
          <Card key={team.id} className="flex flex-col transition-transform transform-gpu hover:-translate-y-1 hover:shadow-xl">
            <CardHeader className="flex-row items-center gap-4">
              <Image
                src={team.logoUrl}
                alt={`${team.name} logo`}
                width={64}
                height={64}
                className="rounded-lg"
                data-ai-hint="team logo"
              />
              <div>
                <CardTitle className="text-lg font-headline">{team.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-sm text-muted-foreground">{team.players.length} players</p>
            </CardContent>
            <CardFooter className="flex justify-between items-center">
              <div className="text-sm font-mono">
                <span className="font-semibold text-green-400">{team.wins}W</span>- 
                <span className="font-semibold text-red-400">{team.losses}L</span>-
                <span className="font-semibold text-gray-400">{team.draws}D</span>
              </div>
              <Button variant="outline" size="sm">View Roster</Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
