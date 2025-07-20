import { registry } from "@/app/lib/metrics/registry";
import { NextResponse } from "next/server";

export async function GET() {
  const metrics = await registry.metrics();
  return new NextResponse(metrics, {
    status: 200,
    headers: { 'Content-Type': registry.contentType },
  });
}
