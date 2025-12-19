import { Button } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";
import { schedule } from "@/lib/data";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Image from "next/image";

export default function SchedulePage() {
  return (
    <div className="space-y-6 animate-in fade-in-50">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-headline font-semibold">Game Schedule</h2>
        <Button>
          <CalendarPlus className="mr-2 h-4 w-4" /> Generate Schedule
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Matchup</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {schedule.map((game) => (
                    <TableRow key={game.id}>
                        <TableCell>
                            <div className="font-medium">{new Date(game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                            <div className="text-sm text-muted-foreground">{game.time}</div>
                        </TableCell>
                        <TableCell className="font-medium">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 min-w-[150px]">
                                    <Image src={game.team1.logoUrl} alt={game.team1.name} width={24} height={24} className="rounded-full" data-ai-hint="team logo" />
                                    <span>{game.team1.name}</span>
                                </div>
                                <span className="text-muted-foreground">vs</span>
                                <div className="flex items-center gap-2 min-w-[150px]">
                                    <Image src={game.team2.logoUrl} alt={game.team2.name} width={24} height={24} className="rounded-full" data-ai-hint="team logo" />
                                    <span>{game.team2.name}</span>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell>{game.venue}</TableCell>
                        <TableCell className="text-right">
                            <Badge variant={game.status === 'completed' ? 'secondary' : 'default'} className="capitalize bg-primary/20 text-primary border-primary/20 hover:bg-primary/30">
                              {game.status}
                            </Badge>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
        </CardContent>
      </Card>
    </div>
  );
}
