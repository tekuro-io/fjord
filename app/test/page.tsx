import { InfluxDB } from '@influxdata/influxdb-client';
import { connection } from 'next/server';

// Makes sure we re-render for each request and it's not statically cached
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

async function queryInflux() {
    await connection()
    const url = process.env.INFLUXDB_URL;
    const token = process.env.INFLUXDB_TOKEN!;

    if (!url || !token) {
        throw new Error("Missing INFLUXDB_URL or INFLUXDB_TOKEN");
    }

    const client = new InfluxDB({ url, token });
    const queryApi = client.getQueryApi("influxdata");

    const fluxQuery = `
    from(bucket: "stocks_5m")
      |> range(start: -30d)
      |> limit(n: 5)
  `;

    const results: string[] = [];

    for await (const row of queryApi.iterateRows(fluxQuery)) {
        results.push(JSON.stringify(row));
    }

    return results;
}

export default async function TestInflux() {
  const results = await queryInflux();

  return (
    <div>
      <h1>InfluxDB Test</h1>
      <pre>{results.join('\n')}</pre>
    </div>
  );
}

