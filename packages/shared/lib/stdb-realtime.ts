/**
 * SpacetimeDB Real-Time Client (browser WebSocket)
 *
 * Subscribes to table changes, auto-reconnects on disconnect.
 */

type TableName = 'agents' | 'votes' | 'delegations' | 'activity_log' | 'tracked_realms';

type ChangeType = 'insert' | 'update' | 'delete';

interface TableChange {
  table: TableName;
  type: ChangeType;
  row: Record<string, unknown>;
  oldRow?: Record<string, unknown>;
}

type ChangeListener = (change: TableChange) => void;

const STDB_WS_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_SPACETIMEDB_WS_URL || 'ws://localhost:3000')
  : '';
const STDB_DB = process.env.NEXT_PUBLIC_SPACETIMEDB_MODULE_NAME || 'clawddao';

class SpacetimeDBRealtimeClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<ChangeListener>> = new Map();
  private globalListeners: Set<ChangeListener> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private identity: string | null = null;
  private token: string | null = null;
  private connected = false;
  private subscriptionSent = false;

  /**
   * Connect to SpacetimeDB WebSocket.
   * Automatically obtains an identity token and subscribes to all tables.
   */
  async connect(): Promise<void> {
    if (this.ws && this.connected) return;

    // Obtain identity token if we don't have one
    if (!this.token) {
      try {
        const res = await fetch(`${STDB_WS_URL.replace('ws', 'http')}/v1/identity`, {
          method: 'POST',
        });
        this.identity = res.headers.get('spacetime-identity');
        this.token = res.headers.get('spacetime-identity-token');
      } catch (err) {
        console.warn('SpacetimeDB identity fetch failed, connecting anonymously:', err);
      }
    }

    const wsUrl = new URL(`/v1/database/${STDB_DB}/subscribe`, STDB_WS_URL);
    if (this.token) {
      wsUrl.searchParams.set('token', this.token);
    }

    this.ws = new WebSocket(wsUrl.toString());

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      console.log('[SpacetimeDB] Connected');

      if (!this.subscriptionSent) {
        this.subscribe([
          'SELECT * FROM agents',
          'SELECT * FROM votes',
          'SELECT * FROM delegations',
          'SELECT * FROM activity_log',
          'SELECT * FROM tracked_realms',
        ]);
        this.subscriptionSent = true;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string);
        this.handleMessage(data);
      } catch {
        // Binary protocol message — skip for now
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.subscriptionSent = false;
      console.log('[SpacetimeDB] Disconnected');
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[SpacetimeDB] WebSocket error:', err);
    };
  }

  private subscribe(queries: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // SpacetimeDB subscribe protocol: send subscription queries
    this.ws.send(JSON.stringify({
      subscribe: {
        query_strings: queries,
      },
    }));
  }

  private handleMessage(data: Record<string, unknown>) {
    // SpacetimeDB sends different message types:
    // - SubscriptionUpdate: initial data + subsequent changes
    // - TransactionUpdate: reducer execution results
    // - IdentityToken: identity assignment

    if (data.type === 'SubscriptionUpdate' || data.type === 'TransactionUpdate') {
      const updates = data.updates as Array<{
        table_name: string;
        inserts: unknown[][];
        deletes: unknown[][];
      }> | undefined;

      if (updates) {
        for (const update of updates) {
          const tableName = update.table_name as TableName;

          for (const row of update.inserts) {
            const change: TableChange = {
              table: tableName,
              type: 'insert',
              row: Array.isArray(row) ? this.rowToObject(row) : (row as Record<string, unknown>),
            };
            this.emit(tableName, change);
          }

          for (const row of update.deletes) {
            const change: TableChange = {
              table: tableName,
              type: 'delete',
              row: Array.isArray(row) ? this.rowToObject(row) : (row as Record<string, unknown>),
            };
            this.emit(tableName, change);
          }
        }
      }
    }
  }

  private rowToObject(row: unknown[]): Record<string, unknown> {
    // SpacetimeDB may send rows as arrays — convert to indexed object
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < row.length; i++) {
      obj[String(i)] = row[i];
    }
    return obj;
  }

  private emit(table: TableName, change: TableChange) {
    // Table-specific listeners
    const tableListeners = this.listeners.get(table);
    if (tableListeners) {
      for (const listener of tableListeners) {
        listener(change);
      }
    }

    // Global listeners
    for (const listener of this.globalListeners) {
      listener(change);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[SpacetimeDB] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log(`[SpacetimeDB] Reconnecting (attempt ${this.reconnectAttempts})...`);
      this.connect();
    }, delay);
  }

  /**
   * Listen for changes on a specific table.
   */
  onTableChange(table: TableName, listener: ChangeListener): () => void {
    if (!this.listeners.has(table)) {
      this.listeners.set(table, new Set());
    }
    this.listeners.get(table)!.add(listener);

    return () => {
      this.listeners.get(table)?.delete(listener);
    };
  }

  /**
   * Listen for changes on any table.
   */
  onAnyChange(listener: ChangeListener): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  /**
   * Disconnect from SpacetimeDB.
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.subscriptionSent = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getIdentity(): string | null {
    return this.identity;
  }
}

// Singleton — one connection per browser tab
let clientInstance: SpacetimeDBRealtimeClient | null = null;

export function getRealtimeClient(): SpacetimeDBRealtimeClient {
  if (!clientInstance) {
    clientInstance = new SpacetimeDBRealtimeClient();
  }
  return clientInstance;
}

export type { TableName, ChangeType, TableChange, ChangeListener };
