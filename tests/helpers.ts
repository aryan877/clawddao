export function createRequest(
  url: string,
  options?: RequestInit & { searchParams?: Record<string, string> },
): Request {
  const fullUrl = new URL(url, 'http://localhost:3000');
  if (options?.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      fullUrl.searchParams.set(key, value);
    }
  }
  return new Request(fullUrl.toString(), options);
}

export async function parseResponse<T = unknown>(response: Response): Promise<{
  status: number;
  body: T;
}> {
  const body = await response.json() as T;
  return { status: response.status, body };
}

export async function readSSEStream(response: Response): Promise<string[]> {
  const text = await response.text();
  return text
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => chunk.replace(/^data: /, ''));
}
