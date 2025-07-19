import { getTickers } from "@/app/lib/redis";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const data = await getTickers();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch tickers" }, { status: 500 });
  }
}
