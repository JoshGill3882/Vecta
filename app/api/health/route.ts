/** Health-check "liveness" endpoint for Docker */
export async function GET() {
  return Response.json({ status: "ok" });
}
