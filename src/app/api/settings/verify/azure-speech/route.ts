import { NextRequest, NextResponse } from "next/server";
import { verifyAzureCredentials } from "@/lib/analysis/azure";

export async function POST(request: NextRequest) {
  try {
    const { apiKey, region } = await request.json();
    if (!apiKey || !region) {
      return NextResponse.json({ valid: false, error: "Missing apiKey or region" }, { status: 400 });
    }
    const result = await verifyAzureCredentials(apiKey, region);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: error instanceof Error ? error.message : "Verification failed" },
      { status: 500 }
    );
  }
}
