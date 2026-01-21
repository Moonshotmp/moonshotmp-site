export default async () => {
  const { getStore } = await import('@netlify/blobs');

  const store = getStore('partners');

  await store.set(
    'test-key',
    JSON.stringify({ message: 'Blobs are working', timestamp: new Date().toISOString() })
  );

  const value = await store.get('test-key', { type: 'json' });

  return new Response(JSON.stringify({ ok: true, value }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
