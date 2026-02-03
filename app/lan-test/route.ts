export async function GET() {
  return new Response("LAN + Next OK ✅", {
    headers: { "content-type": "text/plain" },
  });
}