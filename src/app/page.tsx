import type { Metadata } from "next";
import { LandingContent } from "@/components/landing-content";

export const metadata: Metadata = {
  title: "The Budo League — Fantasy Football for Old Alumini of Budo",
  description:
    "Build your dream squad from real Budo League players. Set captains, make transfers, and compete with friends every gameweek.",
  openGraph: {
    title: "The Budo League — Fantasy Football",
    description:
      "Pick your squad, earn points from real match stats, and climb the leaderboard. Join a premier fantasy football league.",
    images: [{ url: "/icon.jpg", width: 512, height: 512 }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "The Budo League — Fantasy Football",
    description:
      "Pick your squad, earn points from real match stats, and climb the leaderboard.",
    images: ["/icon.jpg"],
  },
};

export default function Home() {
  return <LandingContent />;
}
