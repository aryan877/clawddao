'use client';

import { DbConnection } from '../module_bindings';
import type { Identity } from 'spacetimedb';
import type { ErrorContext } from '../module_bindings';

const STDB_HOST = process.env.NEXT_PUBLIC_SPACETIMEDB_WS_URL || 'ws://localhost:3000';
const STDB_DB = process.env.NEXT_PUBLIC_SPACETIMEDB_MODULE_NAME || 'clawddao';
const TOKEN_KEY = `stdb_${STDB_DB}_token`;

const onConnect = (conn: DbConnection, identity: Identity, token: string) => {
  localStorage.setItem(TOKEN_KEY, token);
  console.log('[SpacetimeDB] Connected:', identity.toHexString());
  conn.subscriptionBuilder().subscribeToAllTables();
};

const onDisconnect = () => {
  console.log('[SpacetimeDB] Disconnected');
};

const onConnectError = (_ctx: ErrorContext, err: Error) => {
  console.error('[SpacetimeDB] Connection error:', err);
};

export const connectionBuilder = DbConnection.builder()
  .withUri(STDB_HOST)
  .withDatabaseName(STDB_DB)
  .withToken(typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) || undefined : undefined)
  .onConnect(onConnect)
  .onDisconnect(onDisconnect)
  .onConnectError(onConnectError);
