'use client';

import { useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { getRealtimeClient, type TableName, type TableChange } from '@shared/lib/stdb-realtime';

/**
 * React hook for real-time SpacetimeDB table subscriptions.
 *
 * Connects to SpacetimeDB WebSocket on mount, subscribes to the given table,
 * and re-renders the component on any insert/update/delete.
 *
 * Usage:
 *   const { changes, isConnected } = useRealtimeTable('proposals');
 */
export function useRealtimeTable(table: TableName) {
  const client = getRealtimeClient();
  const changesRef = useRef<TableChange[]>([]);
  const subscribersRef = useRef(new Set<() => void>());

  // Connect on mount
  useEffect(() => {
    client.connect();
    return () => {
      // Don't disconnect on unmount — singleton connection shared across components
    };
  }, [client]);

  // Subscribe to table changes
  useEffect(() => {
    const unsubscribe = client.onTableChange(table, (change) => {
      changesRef.current = [...changesRef.current.slice(-99), change];
      // Notify all subscribers
      for (const callback of subscribersRef.current) {
        callback();
      }
    });

    return unsubscribe;
  }, [client, table]);

  const subscribe = useCallback((callback: () => void) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  const getSnapshot = useCallback(() => changesRef.current, []);

  const changes = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    changes,
    isConnected: client.isConnected(),
    lastChange: changes[changes.length - 1] ?? null,
  };
}

/**
 * Hook to listen for real-time changes across all tables.
 */
export function useRealtimeChanges() {
  const client = getRealtimeClient();
  const changesRef = useRef<TableChange[]>([]);
  const subscribersRef = useRef(new Set<() => void>());

  useEffect(() => {
    client.connect();
  }, [client]);

  useEffect(() => {
    const unsubscribe = client.onAnyChange((change) => {
      changesRef.current = [...changesRef.current.slice(-199), change];
      for (const callback of subscribersRef.current) {
        callback();
      }
    });
    return unsubscribe;
  }, [client]);

  const subscribe = useCallback((callback: () => void) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  const getSnapshot = useCallback(() => changesRef.current, []);
  const changes = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return { changes, isConnected: client.isConnected() };
}
