import { test } from 'vitest';

test('Fetch localhost:4323 HTML', async () => {
  try {
    const res = await fetch('http://127.0.0.1:4323');
    console.log('STATUS:', res.status);
    const html = await res.text();
    console.log('HTML PREVIEW (first 1000 chars):');
    console.log(html.substring(0, 1000));
  } catch (e) {
    console.error('Fetch error:', e);
  }
});
