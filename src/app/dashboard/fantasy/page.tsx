
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { myFantasyTeam, fantasyStandings, Player } from "@/lib/data";
import { ArrowDown, ArrowUp, Minus, Shield, Swords } from "lucide-react";

const PositionIcon = ({ position }: { position: Player["position"] }) => {
  switch (position) {
    case "Goalkeeper":
      return <Shield className="h-4 w-4 text-yellow-400" />;
    case "Defender":
      return <Shield className="h-4 w-4 text-green-400" />;
    case "Midfielder":
      return <Shield className="h-4 w-4 text-blue-400" />;
    case "Forward":
      return <Swords className="h-4 w-4 text-red-400" />;
    default:
      return null;
  }
};


export default function FantasyPage() {
  const pitchPositions: { [key: string]: Player[] } = {
    'Forwards': myFantasyTeam.players.filter(p => p.position === 'Forward'),
    'Midfielders': myFantasyTeam.players.filter(p => p.position === 'Midfielder'),
    'Defenders': myFantasyTeam.players.filter(p => p.position === 'Defender'),
    'Goalkeepers': myFantasyTeam.players.filter(p => p.position === 'Goalkeeper'),
  };

  return (
    <div className="space-y-8 animate-in fade-in-50">
       <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-headline font-bold tracking-tight">Fantasy League</h2>
          <p className="text-muted-foreground">Your weekly fantasy hub.</p>
        </div>
        <Button>Manage Team</Button>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="flex flex-col-reverse md:col-span-1 md:flex-col space-y-8">
            {/* Points & Rank */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle>My Status</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 rounded-lg bg-card-foreground/5">
                        <p className="text-sm text-muted-foreground">Total Points</p>
                        <p className="text-3xl font-bold font-headline">{myFantasyTeam.points}</p>
                    </div>
                     <div className="text-center p-4 rounded-lg bg-card-foreground/5">
                        <p className="text-sm text-muted-foreground">Overall Rank</p>
                        <p className="text-3xl font-bold font-headline">{myFantasyTeam.rank.toLocaleString()}</p>
                    </div>
                </CardContent>
            </Card>

             {/* Mini Standings */}
            <Card>
                <CardHeader>
                    <CardTitle>Mini-League</CardTitle>
                    <CardDescription>Your rank among rivals.</CardDescription>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60px]">#</TableHead>
                                <TableHead>Team</TableHead>
                                <TableHead className="text-right">Pts</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fantasyStandings.map((team) => (
                                <TableRow key={team.rank} className={team.name === myFantasyTeam.name ? "bg-primary/20" : ""}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-1">
                                            {team.rank < myFantasyTeam.rank ? <ArrowUp className="text-green-400 h-4 w-4"/> : team.rank > myFantasyTeam.rank ? <ArrowDown className="text-red-400 h-4 w-4"/> : <Minus className="h-4 w-4"/> }
                                            <span>{team.rank}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <p className="font-medium">{team.name}</p>
                                        <p className="text-xs text-muted-foreground">{team.owner}</p>
                                    </TableCell>
                                    <TableCell className="text-right font-bold font-mono">{team.points}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                     </Table>
                </CardContent>
            </Card>
        </div>
        
        <div className="md:col-span-2 space-y-8">
            {/* Pitch View */}
            <Card className="bg-green-900/20 border-green-700/50">
                <CardHeader>
                    <CardTitle className="text-white">{myFantasyTeam.name}</CardTitle>
                    <CardDescription>Gameweek 8</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="bg-center bg-no-repeat bg-contain" style={{backgroundImage: "url('/pitch.svg')", height: '450px'}}>
                        <div className="flex flex-col justify-around h-full text-center">
                            {Object.entries(pitchPositions).map(([position, players]) => (
                                <div key={position} className="flex justify-center gap-4">
                                {players.map(player => (
                                    <div key={player.id} className="flex flex-col items-center">
                                        <div className="bg-primary p-1 rounded-t-md">
                                            <span className="text-xs font-bold text-primary-foreground px-2">{player.name}</span>
                                        </div>
                                        <div className="bg-primary/80 p-1 rounded-b-md">
                                            <span className="text-xs text-primary-foreground font-mono">{player.points} pts</span>
                                        </div>
                                    </div>
                                ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* My Team List */}
            <Card>
                <CardHeader>
                    <CardTitle>My Squad</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Player</TableHead>
                                <TableHead>Position</TableHead>
                                <TableHead className="hidden sm:table-cell">Team</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-right">Points</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {myFantasyTeam.players.map(player => (
                                <TableRow key={player.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <Image src={player.avatarUrl} alt={player.name} width={28} height={28} className="rounded-full" data-ai-hint="person avatar" />
                                            <span>{player.name}</span>
                                        </div>
                                    </TableCell>
                                     <TableCell>
                                        <div className="flex items-center gap-2">
                                            <PositionIcon position={player.position} />
                                            <span className="hidden sm:inline">{player.position}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">{player.team}</TableCell>
                                    <TableCell className="text-right font-mono">${player.price}m</TableCell>
                                    <TableCell className="text-right font-mono font-bold">{player.points}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
