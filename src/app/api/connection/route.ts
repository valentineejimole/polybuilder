import { NextResponse } from "next/server";
import { checkBuilderConnection } from "@/lib/clob";

export async function GET() {
  const result = await checkBuilderConnection();
  return NextResponse.json(result, { status: result.connected ? 200 : 503 });
}
