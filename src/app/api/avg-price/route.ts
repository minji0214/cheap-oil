import { NextResponse } from "next/server";
import { fetchAveragePrice } from "@/lib/opinet";
import { FUEL_CODES, type FuelCode } from "@/lib/types";

export const dynamic = "force-dynamic";

function isFuelCode(value: string): value is FuelCode {
  return FUEL_CODES.includes(value as FuelCode);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fuelRaw = searchParams.get("fuel") ?? "B027";
  const regionCode = searchParams.get("regionCode") ?? process.env.OPINET_DEFAULT_REGION_CODE ?? "11";

  if (!isFuelCode(fuelRaw)) {
    return NextResponse.json(
      {
        code: "INVALID_FUEL",
        message: "fuel must be one of B027,D047",
        retryable: false,
      },
      { status: 400 },
    );
  }

  try {
    const response = await fetchAveragePrice(fuelRaw, regionCode);
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Opinet request failed";

    return NextResponse.json(
      {
        code: "UPSTREAM_ERROR",
        message,
        retryable: true,
      },
      { status: 502 },
    );
  }
}
