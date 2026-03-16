"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const CAT_HEX: Record<string, string> = {
  announcement: "#F59E0B", matchday: "#3B82F6", player_spotlight: "#10B981",
  deadline: "#EF4444", general: "#8B5CF6", breaking: "#DC2626",
  transfer_news: "#7C3AED", match_report: "#0EA5E9",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CalendarItem = {
  id: number;
  title: string;
  category: string;
  status: string;
  created_at: string;
  publish_at: string | null;
};

function toKampalaDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Africa/Kampala" });
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export default function ContentCalendar({
  items,
  onDayClick,
}: {
  items: CalendarItem[];
  onDayClick: (date: string) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const todayStr = toKampalaDate(new Date().toISOString());

  // Group items by date
  const itemsByDate = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    for (const item of items) {
      const dateStr = item.status === "scheduled" && item.publish_at
        ? toKampalaDate(item.publish_at)
        : toKampalaDate(item.created_at);
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(item);
    }
    return map;
  }, [items]);

  const days = getDaysInMonth(currentMonth.year, currentMonth.month);
  const firstDayOfWeek = (days[0].getDay() + 6) % 7; // Monday = 0
  const monthLabel = new Date(currentMonth.year, currentMonth.month).toLocaleDateString("en-UG", {
    month: "long",
    year: "numeric",
  });

  function prevMonth() {
    setCurrentMonth((prev) => {
      const d = new Date(prev.year, prev.month - 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function nextMonth() {
    setCurrentMonth((prev) => {
      const d = new Date(prev.year, prev.month + 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-semibold">{monthLabel}</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for padding */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`pad-${i}`} className="aspect-square" />
        ))}

        {days.map((day) => {
          const dateStr = day.toISOString().split("T")[0]; // YYYY-MM-DD
          const kampalaStr = toKampalaDate(day.toISOString());
          const dayItems = itemsByDate[kampalaStr] ?? itemsByDate[dateStr] ?? [];
          const isToday = kampalaStr === todayStr || dateStr === todayStr;
          const hasItems = dayItems.length > 0;

          // Get unique categories for dots (max 3)
          const uniqueCats = [...new Set(dayItems.map((i) => i.category))].slice(0, 3);

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => hasItems && onDayClick(dateStr)}
              className={cn(
                "aspect-square rounded-lg border flex flex-col items-center justify-center gap-0.5 text-xs transition-all",
                isToday && "border-primary bg-primary/5 font-bold",
                !isToday && "border-transparent hover:border-border",
                hasItems && "cursor-pointer hover:bg-muted/50",
                !hasItems && "cursor-default text-muted-foreground",
              )}
            >
              <span>{day.getDate()}</span>
              {hasItems && (
                <div className="flex gap-0.5">
                  {uniqueCats.map((cat) => (
                    <span
                      key={cat}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: CAT_HEX[cat] || "#8B5CF6" }}
                    />
                  ))}
                </div>
              )}
              {dayItems.length > 1 && (
                <span className="text-[9px] text-muted-foreground leading-none">{dayItems.length}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
