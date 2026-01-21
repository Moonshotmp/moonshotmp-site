import { getStore } from '@netlify/blobs';

export default async () => {
  // Create or access a Blob store named "partners"
  const store = getStore('partners');

  // Write a test value
  await store.set('test-key', JSON.stringify({
    message: 'Blobs are working',
    timestamp: new Date().toISOString()
  }));

  // Read it back
  const value = await store.get('test-key', { type: 'json' });

  return new Response(
    JSON.stringify({ ok: true, value }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
};
