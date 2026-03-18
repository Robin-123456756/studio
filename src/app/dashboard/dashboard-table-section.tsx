"use client";

import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { posBarClass } from "./dashboard-ui";
import type { Row } from "./dashboard-types";

type DashboardTableSectionProps = {
  expanded: boolean;
  loading: boolean;
  onToggleExpanded: () => void;
  table: Row[];
};

export function DashboardTableSection({
  expanded,
  loading,
  onToggleExpanded,
  table,
}: DashboardTableSectionProps) {
  const visibleRows = expanded ? table : table.slice(0, 5);

  return (
    <Card className="rounded-3xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-headline">League snapshot</CardTitle>
          {table.length > 5 && (
            <button
              type="button"
              onClick={onToggleExpanded}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {expanded ? "Show less" : "View full standings"}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        {loading ? (
          <div className="px-2 py-3 space-y-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-2.5">
                <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                <Skeleton className="h-4 flex-1 rounded" />
                <Skeleton className="h-4 w-6 rounded" />
                <Skeleton className="h-4 w-6 rounded" />
                <Skeleton className="h-4 w-8 rounded" />
              </div>
            ))}
          </div>
        ) : table.length === 0 ? (
          <div className="px-2 py-6 text-sm text-muted-foreground">No table data yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="text-[11px]">
                <TableHead className="w-[42px] pl-2 pr-1">Pos</TableHead>
                <TableHead className="w-[140px] pr-1">Team</TableHead>
                <TableHead className="w-[28px] px-1 text-center">PL</TableHead>
                <TableHead className="w-[28px] px-1 text-center">W</TableHead>
                <TableHead className="w-[32px] px-1 text-center">GD</TableHead>
                <TableHead className="w-[28px] px-1 text-center">LP</TableHead>
                <TableHead className="w-[32px] px-1 text-center">Pts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row, index) => {
                const pos = index + 1;
                const bar = posBarClass(pos);
                return (
                  <TableRow key={row.teamId} className="text-[12px]">
                    <TableCell className="py-2 pl-2 pr-1">
                      <div className="flex items-center gap-1.5">
                        <div className={`h-5 w-1.5 rounded-full ${bar}`} />
                        <span className="font-semibold tabular-nums">{pos}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 pr-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <Image
                          src={row.logoUrl}
                          alt={row.name}
                          width={20}
                          height={20}
                          className="rounded-full shrink-0"
                        />
                        <span className="truncate text-[12px] font-medium">{row.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 px-1 text-center font-mono tabular-nums">{row.PL}</TableCell>
                    <TableCell className="py-2 px-1 text-center font-mono tabular-nums">{row.W}</TableCell>
                    <TableCell className="py-2 px-1 text-center font-mono tabular-nums">{row.GD}</TableCell>
                    <TableCell className="py-2 px-1 text-center font-mono tabular-nums text-pink-600">
                      {row.LP}
                    </TableCell>
                    <TableCell className="py-2 px-1 text-center font-mono font-bold tabular-nums">
                      {row.Pts}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {!loading && table.length > 0 && (
          <div className="pt-3 px-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-1.5 rounded-full bg-emerald-500" />
              <span>Main Cup</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-1.5 rounded-full bg-amber-500" />
              <span>Semivule Cup</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
