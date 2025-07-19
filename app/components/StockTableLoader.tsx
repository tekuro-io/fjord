import StockTable from "./StockTable";
import { connection } from "next/server";
import { getTickers } from "../lib/redis";

export default async function StockTableLoader() {
    await connection() // Disables pre-rendering
    const data = await getTickers();
    return <StockTable data={data} />;
}

export const dynamic = "force-dynamic";
