"use client";

import { cn, formatNumber } from "@shared/lib/utils";
import type { Realm } from "@shared/types/governance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Wallet, ChevronRight } from "lucide-react";
import Link from "next/link";

interface DaoCardProps {
  realm: Realm;
  proposalCount: number;
  className?: string;
}

export function DaoCard({ realm, proposalCount, className }: DaoCardProps) {
  return (
    <Link href={`/dashboard/${realm.address}`} className="block">
      <Card
        className={cn(
          "group cursor-pointer transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
          className
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {realm.logoUrl ? (
                <img
                  src={realm.logoUrl}
                  alt={realm.name}
                  className="h-10 w-10 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="text-sm font-bold">
                    {realm.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <CardTitle className="text-base font-semibold text-foreground">
                {realm.name}
              </CardTitle>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span className="text-xs">Members</span>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {formatNumber(realm.memberCount)}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                <span className="text-xs">Proposals</span>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {formatNumber(proposalCount)}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" />
                <span className="text-xs">Treasury</span>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {realm.treasuryBalance !== undefined
                  ? `${formatNumber(realm.treasuryBalance)} SOL`
                  : "--"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
