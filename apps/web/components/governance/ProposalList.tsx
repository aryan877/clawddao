"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@shared/lib/utils";
import type { Proposal } from "@shared/types/governance";
import { ProposalCard } from "@/components/governance/ProposalCard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileSearch } from "lucide-react";

type FilterTab = "all" | "voting" | "succeeded" | "defeated";

const TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "voting", label: "Voting" },
  { value: "succeeded", label: "Succeeded" },
  { value: "defeated", label: "Defeated" },
];

interface ProposalListProps {
  proposals: Proposal[];
  className?: string;
}

export function ProposalList({ proposals, className }: ProposalListProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const filteredProposals = useMemo(() => {
    if (activeTab === "all") return proposals;
    return proposals.filter((p) => p.status === activeTab);
  }, [proposals, activeTab]);

  const counts = useMemo(() => {
    return {
      all: proposals.length,
      voting: proposals.filter((p) => p.status === "voting").length,
      succeeded: proposals.filter((p) => p.status === "succeeded").length,
      defeated: proposals.filter((p) => p.status === "defeated").length,
    };
  }, [proposals]);

  return (
    <div className={cn("space-y-6", className)}>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
              <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {counts[tab.value]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {filteredProposals.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredProposals.map((proposal, index) => (
                  <Link
                    key={proposal.address}
                    href={`/dashboard/${proposal.realmAddress}/proposals/${proposal.address}`}
                    className="animate-fade-in block"
                    style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
                  >
                    <ProposalCard proposal={proposal} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-16">
                <FileSearch className="h-10 w-10 text-muted-foreground/50" />
                <h3 className="mt-4 text-sm font-medium text-foreground">No proposals found</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activeTab === "all"
                    ? "There are no proposals to display."
                    : `No proposals with "${activeTab}" status.`}
                </p>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
