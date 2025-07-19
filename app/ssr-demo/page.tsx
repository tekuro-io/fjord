export const dynamic = 'force-dynamic'; // makes sure SSR runs on every request

export default async function SSRDemoPage() {
  const now = new Date().toISOString();

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>🧠 Server-Side Rendered (App Router)</h1>
      <p>This page was rendered on the server at:</p>
      <pre>{now}</pre>
    </main>
  );
}
