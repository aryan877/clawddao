import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse, readSSEStream } from '../helpers';
import { makeAuthRequest, VALID_USER_ID } from '../fixtures';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@shared/lib/auth', () => ({
  verifyAuth: vi.fn(),
  AuthError: class AuthError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 401) {
      super(message);
      this.name = 'AuthError';
      this.statusCode = statusCode;
    }
  },
}));

vi.mock('@shared/lib/ai', () => ({
  streamChat: vi.fn(),
}));

import { verifyAuth, AuthError } from '@shared/lib/auth';
import { streamChat } from '@shared/lib/ai';
import { POST } from '@/app/api/ai/chat/route';

const mockVerifyAuth = vi.mocked(verifyAuth);
const mockStreamChat = vi.mocked(streamChat);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeChatRequest(body: unknown, authenticated = true) {
  if (authenticated) {
    return makeAuthRequest('http://localhost:3000/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  return new Request('http://localhost:3000/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function* makeAsyncIterable(events: Array<Record<string, unknown>>) {
  for (const event of events) {
    yield event;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/ai/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 JSON response without auth (not SSE)', async () => {
    mockVerifyAuth.mockRejectedValue(new AuthError('Missing Authorization header'));

    const request = makeChatRequest(
      { messages: [{ role: 'user', content: 'Hello' }] },
      false,
    );
    const response = await POST(request as never);

    expect(response.status).toBe(401);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const body = await response.json();
    expect(body).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('returns 400 when messages is missing', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });

    const request = makeChatRequest({});
    const response = await POST(request as never);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({ error: expect.stringContaining('messages') }),
    );
  });

  it('returns 400 when messages is an empty array', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });

    const request = makeChatRequest({ messages: [] });
    const response = await POST(request as never);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({ error: expect.stringContaining('messages') }),
    );
  });

  it('returns SSE stream with data: lines ending in [DONE] on success', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });

    const streamEvents = [
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } },
    ];
    mockStreamChat.mockResolvedValue(makeAsyncIterable(streamEvents) as never);

    const request = makeChatRequest({
      messages: [{ role: 'user', content: 'Explain this proposal' }],
      context: { realmName: 'TestDAO' },
    });
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');

    const chunks = await readSSEStream(response);

    // Should have text chunks + [DONE]
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks[chunks.length - 1]).toBe('[DONE]');

    // Verify text content
    const textChunks = chunks.slice(0, -1);
    for (const chunk of textChunks) {
      const parsed = JSON.parse(chunk);
      expect(parsed.type).toBe('text');
      expect(typeof parsed.text).toBe('string');
    }
  });

  it('passes messages and context to streamChat', async () => {
    mockVerifyAuth.mockResolvedValue({ authenticated: true, userId: VALID_USER_ID });
    mockStreamChat.mockResolvedValue(makeAsyncIterable([]) as never);

    const messages = [{ role: 'user', content: 'What does this do?' }];
    const context = { realmName: 'Marinade' };

    const request = makeChatRequest({ messages, context });
    await POST(request as never);

    expect(mockStreamChat).toHaveBeenCalledWith(messages, context);
  });
});
