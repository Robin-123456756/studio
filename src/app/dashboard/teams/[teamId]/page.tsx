<CardContent className="px-3 py-2">
  <div className="flex items-center justify-between gap-3">
    {/* Left */}
    <div className="flex items-center gap-2 min-w-0">
      <div className="h-9 w-9 rounded-full overflow-hidden bg-muted shrink-0">
        <img
          src={p.avatarUrl ?? "/placeholder-player.png"}
          alt={p.name}
          className="h-9 w-9 object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="min-w-0">
        <div className="text-[13px] font-semibold truncate leading-[1.1]">
          {p.name}
          {p.isLady ? <span className="text-pink-600"> • Lady</span> : null}
        </div>

        <div className="text-[11px] text-muted-foreground truncate leading-[1.1]">
          {p.teamName ?? p.teamShort ?? "—"} • {p.position}
        </div>
      </div>
    </div>

    {/* Right */}
    <div className="flex items-center gap-4 shrink-0">
      <div className="text-right">
        <div className="text-[10px] text-muted-foreground leading-[1.1]">Price</div>
        <div className="text-[13px] font-mono font-semibold tabular-nums leading-[1.1]">
          ${p.price ?? 0}m
        </div>
      </div>

      <div className="text-right">
        <div className="text-[10px] text-muted-foreground leading-[1.1]">Pts</div>
        <div className="text-[13px] font-mono font-extrabold tabular-nums leading-[1.1]">
          {p.points ?? 0}
        </div>
      </div>
    </div>
  </div>
</CardContent>
