import { NextResponse } from "next/server";
import { fetchStationDetail } from "@/lib/opinet";

export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ stationId: string }>;
};

export async function GET(_request: Request, context: Context) {
  const { stationId } = await context.params;

  if (!stationId) {
    return NextResponse.json(
      {
        code: "INVALID_STATION_ID",
        message: "stationId is required",
        retryable: false,
      },
      { status: 400 },
    );
  }

  try {
    const detail = await fetchStationDetail(stationId);

    if (!detail) {
      return NextResponse.json(
        {
          code: "NOT_FOUND",
          message: "station detail not found",
          retryable: false,
        },
        { status: 404 },
      );
    }

    return NextResponse.json(detail);
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
