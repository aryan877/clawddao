import { PrivyClient } from '@privy-io/server-auth';

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

let privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (privyClient) return privyClient;

  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;

  if (!appId || !appSecret) {
    throw new AuthError(
      'Server authentication not configured. Set PRIVY_APP_ID and PRIVY_APP_SECRET.',
      500,
    );
  }

  privyClient = new PrivyClient(appId, appSecret);
  return privyClient;
}

export async function verifyAuth(
  request: Request,
): Promise<{ authenticated: true; userId: string }> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    throw new AuthError('Missing Authorization header');
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new AuthError('Malformed Authorization header. Expected: Bearer <token>');
  }

  const token = match[1];
  const client = getPrivyClient();

  try {
    const claims = await client.verifyAuthToken(token);
    return { authenticated: true, userId: claims.userId };
  } catch {
    throw new AuthError('Invalid or expired token');
  }
}

/** Reset client singleton — used by tests only */
export function _resetAuthClient(): void {
  privyClient = null;
}
