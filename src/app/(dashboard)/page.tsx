import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, Trophy, History } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { teams, schedule, standings, recentScores } from "@/lib/data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ChartTooltipContent } from "@/components/ui/chart";

export default function DashboardPage() {
  const upcomingGames = schedule.filter(g => new Date(g.date) >= new Date()).length;
  const chartData = standings.map(team => ({ name: team.name, points: team.wins * 3 + team.draws }));

  return (
    <div className="space-y-8 animate-in fade-in-50">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teams.length}</div>
            <p className="text-xs text-muted-foreground">Currently in the league</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Games</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingGames}</div>
            <p className="text-xs text-muted-foreground">Scheduled matches</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Team</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{standings[0].name}</div>
            <p className="text-xs text-muted-foreground">{standings[0].wins * 3 + standings[0].draws} points</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>League Standings (Points)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis
                  dataKey="name"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                />
                 <Tooltip
                  cursor={{ fill: 'hsl(var(--accent))', opacity: 0.1 }}
                  content={<ChartTooltipContent />}
                />
                <Bar dataKey="points" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Recent Results
            </CardTitle>
          </CardHeader>
          <CardContent>
             <Table>
              <TableBody>
                {recentScores.map((game) => (
                   <TableRow key={game.id}>
                    <TableCell>{format(new Date(game.date), 'MMM d')}</TableCell>
                    <TableCell>
                      {game.team1.name} vs {game.team2.name}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">{game.score1} - {game.score2}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell>5d ago</TableCell>
                  <TableCell>New rule about substitutions added.</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
             </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
