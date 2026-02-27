'use client';

import { cn } from '@shared/lib/utils';
import { ChevronDown } from 'lucide-react';
import type { FeedFilter, FeedSort } from '@/lib/feed-types';

interface FeedFilterBarProps {
  filter: FeedFilter;
  sort: FeedSort;
  itemCount: number;
  onFilterChange: (f: FeedFilter) => void;
  onSortChange: (s: FeedSort) => void;
}

const FILTERS: { key: FeedFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'new', label: 'New' },
  { key: 'completed', label: 'Completed' },
  { key: 'reasoning', label: 'Reasoning' },
];

const SORTS: { key: FeedSort; label: string }[] = [
  { key: 'hot', label: 'Hot' },
  { key: 'new', label: 'New' },
  { key: 'top', label: 'Top' },
];

export function FeedFilterBar({
  filter,
  sort,
  itemCount,
  onFilterChange,
  onSortChange,
}: FeedFilterBarProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Filter pills */}
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
              filter === f.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Sort dropdown */}
      <div className="relative">
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as FeedSort)}
          className="appearance-none rounded-lg border border-border bg-card py-1.5 pl-3 pr-8 text-xs font-medium text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
      </div>

      {/* Item count */}
      <span className="ml-auto text-xs text-muted-foreground">
        {itemCount} {itemCount === 1 ? 'item' : 'items'}
      </span>
    </div>
  );
}
