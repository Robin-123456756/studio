"use client";

import Link from "next/link";
import { ArrowLeft, Users, Zap, Trophy, Coins, ArrowLeftRight, Calendar, Shield, Star } from "lucide-react";
import { cn } from "@/lib/utils";

type RuleSection = {
  title: string;
  icon: React.ReactNode;
  rules: string[];
};

const ruleSections: RuleSection[] = [
  {
    title: "Squad Rules",
    icon: <Users className="h-5 w-5" />,
    rules: [
      "Your squad must contain exactly 17 players",
      "You must have exactly 2 Goalkeepers (GK)",
      "You must have exactly 2 Lady Forwards",
      "The remaining 13 slots can be filled with Defenders, Midfielders, and male Forwards",
      "You cannot have more than 3 players from the same team",
    ],
  },
  {
    title: "Starting 10 Rules",
    icon: <Zap className="h-5 w-5" />,
    rules: [
      "Your starting lineup must contain exactly 10 players",
      "Exactly 1 Goalkeeper must start",
      "Formation rules: 2–3 DEF, 3–4 MID, 2–3 FWD",
      "Lady forward is optional (if you field her, your team earns +1 LP in the table)",
      "Only starting players earn points for your team",
    ],
  },
  {
    title: "Captain & Vice-Captain",
    icon: <Trophy className="h-5 w-5" />,
    rules: [
      "You must select a Captain and a Vice-Captain from your Starting 10",
      "Your Captain's points are doubled each gameweek",
      "If your Captain doesn't play, the Vice-Captain's points are doubled instead",
      "Captain and Vice-Captain must be different players",
    ],
  },
  {
    title: "Budget & Pricing",
    icon: <Coins className="h-5 w-5" />,
    rules: [
      "You have a total budget of UGX 100 million",
      "Each player has a price based on their expected performance",
      "Player prices may change throughout the season based on demand",
      "You cannot exceed your budget when making transfers",
    ],
  },
  {
    title: "Transfers",
    icon: <ArrowLeftRight className="h-5 w-5" />,
    rules: [
      "You get 1 free transfer per gameweek",
      "Unused free transfers roll over (max 2 saved)",
      "Additional transfers cost -4 points each (a 'hit')",
      "Transfers lock when the gameweek deadline passes",
      "Wildcard chip allows unlimited free transfers for one gameweek",
    ],
  },
  {
    title: "Gameweeks & Deadlines",
    icon: <Calendar className="h-5 w-5" />,
    rules: [
      "The season is divided into multiple gameweeks",
      "Each gameweek has a deadline before the first match kicks off",
      "All transfers and team changes must be made before the deadline",
      "Points are calculated after all matches in the gameweek are complete",
    ],
  },
  {
    title: "Chips",
    icon: <Star className="h-5 w-5" />,
    rules: [
      "Bench Boost: All 7 bench players earn points for one gameweek",
      "Triple Captain: Captain earns 3x points instead of 2x",
      "Wildcard: Make unlimited free transfers (can be used twice per season)",
      "Free Hit: Make unlimited transfers for one gameweek only, then reverts",
      "Each chip can only be used once per season (except Wildcard)",
    ],
  },
  {
    title: "Scoring System",
    icon: <Shield className="h-5 w-5" />,
    rules: [
      "Goals: Forward 4pts, Midfielder 5pts, Defender 6pts, Goalkeeper 6pts",
      "Assists: 3pts for all positions",
      "Clean Sheet: Goalkeeper 4pts, Defender 4pts, Midfielder 1pt",
      "Saves: Goalkeeper earns 1pt per 3 saves",
      "Bonus Points: 1-3 bonus points awarded to best performers in each match",
      "Yellow Card: -1pt, Red Card: -3pts",
      "Own Goal: -2pts, Penalty Miss: -2pts",
      "LP: +1 league point if a team fields a lady forward in a match",
    ],
  },
];

export default function TBLRulesPage() {
  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/more"
          className="h-10 w-10 rounded-full border bg-card grid place-items-center hover:bg-accent"
          aria-label="Back to More"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">TBL Rules</h1>
          <p className="text-sm text-muted-foreground">Everything you need to know</p>
        </div>
      </div>

      {/* Intro Card */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-4">
        <h2 className="text-lg font-bold text-primary">Welcome to The Budo League Fantasy!</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Build your dream squad of 17 players, select your best Starting 9 each gameweek,
          and compete against other managers in The Budo League. Read the rules below to
          maximize your points and climb the leaderboard!
        </p>
      </div>

      {/* Rule Sections */}
      <div className="space-y-4">
        {ruleSections.map((section, index) => (
          <div
            key={section.title}
            className={cn(
              "rounded-2xl border bg-card overflow-hidden",
              "animate-in fade-in-50 slide-in-from-bottom-2"
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Section Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary grid place-items-center">
                {section.icon}
              </div>
              <h3 className="text-base font-semibold">{section.title}</h3>
            </div>

            {/* Rules List */}
            <ul className="p-4 space-y-3">
              {section.rules.map((rule, ruleIndex) => (
                <li key={ruleIndex} className="flex items-start gap-3">
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  <span className="text-sm text-muted-foreground leading-relaxed">{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="rounded-2xl border bg-card p-4">
        <h3 className="text-base font-semibold mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/dashboard/fantasy/pick-team"
            className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-3 text-sm font-medium hover:bg-primary/20"
          >
            <Users className="h-4 w-4 text-primary" />
            Pick Team
          </Link>
          <Link
            href="/dashboard/transfers"
            className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-3 text-sm font-medium hover:bg-primary/20"
          >
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            Transfers
          </Link>
          <Link
            href="/dashboard/fantasy"
            className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-3 text-sm font-medium hover:bg-primary/20"
          >
            <Trophy className="h-4 w-4 text-primary" />
            Fantasy Home
          </Link>
          <Link
            href="/dashboard/matches"
            className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-3 text-sm font-medium hover:bg-primary/20"
          >
            <Calendar className="h-4 w-4 text-primary" />
            Fixtures
          </Link>
        </div>
      </div>

      {/* Footer Note */}
      <div className="text-center text-xs text-muted-foreground px-4">
        <p>Rules may be updated during the season. Check back regularly for any changes.</p>
        <p className="mt-1">Good luck and enjoy The Budo League!</p>
      </div>
    </div>
  );
}
