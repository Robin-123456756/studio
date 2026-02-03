import { cn } from "@/lib/utils";

export type Player = {
  id: string;
  name: string;
  webName?: string | null;
  position: "Goalkeeper" | "Defender" | "Midfielder" | "Forward" | string;
  points: number;
  price: number;
  avatarUrl?: string | null;
  isLady?: boolean;
  teamName?: string | null;
  teamShort?: string | null;
};

interface PlayerCardProps {
  player: Player;
  active?: boolean;
  disabled?: boolean;
  variant?: "default" | "out" | "in";
  onClick?: () => void;
}

export function PlayerCard({
  player: p,
  active = false,
  disabled = false,
  variant = "default",
  onClick,
}: PlayerCardProps) {
  const variantClasses = {
    default: "bg-card hover:bg-accent/10",
    out: active ? "border-red-500 bg-red-50" : "bg-card hover:bg-accent/10",
    in: active ? "border-emerald-600 bg-emerald-50" : "bg-card hover:bg-accent/10",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full rounded-2xl border px-3 py-3 text-left transition",
        variantClasses[variant],
        disabled ? "opacity-60 cursor-not-allowed" : ""
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-full overflow-hidden bg-muted shrink-0">
            {p.avatarUrl ? (
              <img src={p.avatarUrl} alt={p.name} className="h-10 w-10 object-cover" />
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {p.name} {p.isLady ? <span className="text-pink-600">• Lady</span> : null}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {p.teamName ?? p.teamShort ?? "—"} • {p.position}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-xs text-muted-foreground">Price</div>
          <div className="font-mono font-bold tabular-nums">${Number(p.price ?? 0)}m</div>

          <div className="mt-1 text-[11px] text-muted-foreground">Pts</div>
          <div className="font-mono font-bold tabular-nums">{Number(p.points ?? 0)}</div>
        </div>
      </div>
    </button>
  );
}
