// app/api/_health/route.js
export async function GET() {
  return Response.json({ ok: true, ts: new Date().toISOString() });
}
