'use client';

import { DbConnection } from '../module_bindings';
import type { Identity } from 'spacetimedb';
import type { ErrorContext } from '../module_bindings';

const STDB_HOST = process.env.NEXT_PUBLIC_SPACETIMEDB_WS_URL || 'ws://localhost:3000';
const STDB_DB = process.env.NEXT_PUBLIC_SPACETIMEDB_MODULE_NAME || 'clawddao';
const TOKEN_KEY = `stdb_${STDB_DB}_token`;

const onConnect = (_conn: DbConnection, identity: Identity, token: string) => {
  localStorage.setItem(TOKEN_KEY, token);
  console.log('[SpacetimeDB] Connected:', identity.toHexString());
  // NOTE: Do NOT call subscribeToAllTables() here.
  // useTable() manages its own per-table subscriptions automatically.
};

const onDisconnect = () => {
  console.log('[SpacetimeDB] Disconnected');
};

const onConnectError = (_ctx: ErrorContext, err: Error) => {
  console.error('[SpacetimeDB] Connection error:', err);

  // If the saved token is invalid (e.g. STDB was recreated), clear it and reload
  // so the next connection attempt gets a fresh anonymous token.
  const msg = err?.message || String(err);
  if (
    msg.includes('TokenError') ||
    msg.includes('InvalidSignature') ||
    msg.includes('Unauthorized') ||
    msg.includes('verify token') ||
    msg.includes('401')
  ) {
    console.warn('[SpacetimeDB] Stale token detected — clearing and reconnecting...');
    localStorage.removeItem(TOKEN_KEY);
    window.location.reload();
  }
};

// Read saved token for session continuity (avoids new identity each page load).
const savedToken =
  typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) || undefined : undefined;

export const connectionBuilder = DbConnection.builder()
  .withUri(STDB_HOST)
  .withDatabaseName(STDB_DB)
  .withToken(savedToken)
  .onConnect(onConnect)
  .onDisconnect(onDisconnect)
  .onConnectError(onConnectError);
