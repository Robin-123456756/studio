import { ArrowRight, Clock3, ArrowLeftCircle, ArrowRightCircle } from "lucide-react";

function TransferBadge({ kind }: { kind: "out" | "in" }) {
  return kind === "out" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-1 text-xs font-semibold">
      <ArrowLeftCircle className="h-4 w-4" />
      OUT
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-1 text-xs font-semibold">
      <ArrowRightCircle className="h-4 w-4" />
      IN
    </span>
  );
}

export type TransferLogItem = {
  gwId: number;
  ts: string; // ISO timestamp
  outId: string;
  inId: string;
  outName?: string;
  inName?: string;
  outTeamShort?: string | null;
  inTeamShort?: string | null;
  outPos?: string | null;
  inPos?: string | null;
  outPrice?: number | null;
  inPrice?: number | null;
};

type Player = {
  name: string;
  teamShort?: string | null;
  position: string;
  price: number;
};

function formatUGX(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "UGX --";
  return `UGX ${value.toFixed(1)}m`;
}

interface TransferLogItemProps {
  transfer: TransferLogItem;
  outPlayer?: Player | null;
  inPlayer?: Player | null;
  formatTime: (iso: string) => string;
}

export function TransferLogItemComponent({
  transfer: t,
  outPlayer: outNow,
  inPlayer: inNow,
  formatTime,
}: TransferLogItemProps) {
  return (
    <div className="rounded-2xl border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-4 w-4" /> {formatTime(t.ts)}
        </span>
        <span className="font-mono">GW {t.gwId}</span>
      </div>

      {/* OUT */}
      <div className="flex items-center justify-between rounded-xl bg-red-50 border border-red-200 px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TransferBadge kind="out" />
            <div className="text-sm font-semibold truncate">
              {outNow?.name ?? t.outName ?? t.outId}
            </div>
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {outNow?.teamShort ?? t.outTeamShort ?? "--"} - {outNow?.position ?? t.outPos ?? "--"}
          </div>
        </div>
        <div className="text-sm font-mono font-bold tabular-nums">
          {formatUGX(outNow?.price ?? null)}
        </div>
      </div>

      {/* Arrow */}
      <div className="flex items-center justify-center">
        <div className="h-8 w-8 rounded-full bg-muted grid place-items-center">
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* IN */}
      <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TransferBadge kind="in" />
            <div className="text-sm font-semibold truncate">
              {inNow?.name ?? t.inName ?? t.inId}
            </div>
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {inNow?.teamShort ?? t.inTeamShort ?? "--"} - {inNow?.position ?? t.inPos ?? "--"}
          </div>
        </div>
        <div className="text-sm font-mono font-bold tabular-nums">
          {formatUGX(inNow?.price ?? null)}
        </div>
      </div>
    </div>
  );
}
