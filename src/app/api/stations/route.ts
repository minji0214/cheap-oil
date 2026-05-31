import { NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";
import {
  buildStationsResponse,
  clampRadius,
  computePriceInsight,
  fetchAveragePrice,
  fetchStationsWithFallback,
  getCacheTtlMs,
  roundCoordinate,
} from "@/lib/opinet";
import { FUEL_CODES, type FuelCode, type StationsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

function isFuelCode(value: string): value is FuelCode {
  return FUEL_CODES.includes(value as FuelCode);
}

function toNumber(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = toNumber(searchParams.get("lat"));
  const lng = toNumber(searchParams.get("lng"));
  const radiusRaw = toNumber(searchParams.get("radius")) ?? 3000;
  const radius = clampRadius(radiusRaw);
  const fuelRaw = searchParams.get("fuel") ?? "B027";
  const regionCode = searchParams.get("regionCode") ?? process.env.OPINET_DEFAULT_REGION_CODE ?? "11";

  if (lat == null || lng == null) {
    return NextResponse.json(
      {
        code: "INVALID_COORDINATES",
        message: "lat/lng query is required",
        retryable: false,
      },
      { status: 400 },
    );
  }

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

  const fuel = fuelRaw;
  const latBucket = roundCoordinate(lat);
  const lngBucket = roundCoordinate(lng);
  const cacheKey = `stations:${fuel}:${radius}:${regionCode}:${latBucket}:${lngBucket}`;
  const cached = getCached<StationsResponse>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const { stations, usedKatechFallback } = await fetchStationsWithFallback(lat, lng, fuel, radius);

    if (stations.length === 0) {
      return NextResponse.json(
        {
          code: "NO_STATIONS",
          message: "반경 내 주유소를 찾지 못했어요",
          retryable: true,
        },
        { status: 404 },
      );
    }

    let avgPrice = 0;
    try {
      const avg = await fetchAveragePrice(fuel, regionCode);
      avgPrice = avg.avgPrice;
    } catch {
      avgPrice = Math.round(stations.reduce((sum, item) => sum + item.price, 0) / stations.length);
    }

    const insight = computePriceInsight(stations, avgPrice);
    const response = buildStationsResponse(stations, insight, usedKatechFallback ? "fallback" : "opinet");

    setCached(cacheKey, response, getCacheTtlMs());

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
