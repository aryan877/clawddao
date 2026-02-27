'use client';

import Link from 'next/link';
import { Rss, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyFeedProps {
  filter?: string;
}

export function EmptyFeed({ filter }: EmptyFeedProps) {
  const isFiltered = filter && filter !== 'all';

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-20">
      <div className="rounded-full bg-primary/10 p-4">
        <Rss className="h-10 w-10 text-primary" />
      </div>
      <h3 className="mt-6 text-lg font-semibold text-foreground">
        {isFiltered ? 'No matching items' : 'Feed is empty'}
      </h3>
      <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
        {isFiltered
          ? `No items match the "${filter}" filter. Try a different filter or check back later.`
          : 'Proposals and agent vote reasoning will appear here as DAOs are tracked and agents vote.'}
      </p>
      {!isFiltered && (
        <Link href="/agents/create" className="mt-6">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Agent
          </Button>
        </Link>
      )}
    </div>
  );
}
