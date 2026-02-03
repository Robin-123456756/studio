import { ArrowLeftCircle, ArrowRightCircle } from "lucide-react";

interface TransferBadgeProps {
  kind: "out" | "in";
}

export function TransferBadge({ kind }: TransferBadgeProps) {
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
