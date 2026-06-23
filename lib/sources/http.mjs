export async function fetchText(url, {
  fetchImpl = globalThis.fetch,
  headers = {},
} = {}) {
  const response = await fetchImpl(url, {
    headers: {
      'user-agent': 'goods-radar/0.1 public-source-radar',
      ...headers,
    },
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    url,
    text,
    contentType: response.headers?.get?.('content-type') || '',
  };
}
