import { sseProxy } from "@/app/lib/sse";

export const runtime = 'nodejs';

type Params = Promise<{ ticker: string }>;

export async function GET(
  _req: Request,
  { params }: { params: Params }
) {

  let { ticker } = await params
  ticker = ticker.toUpperCase()

  const url = `https://sentiment.tekuro.io/sse/${ticker}`;

  return sseProxy(url)
}
