import proj4 from "proj4";
import type {
  AvgPriceResponse,
  FuelCode,
  PriceInsight,
  StationCard,
  StationDetailResponse,
  StationsResponse,
} from "@/lib/types";

const OPINET_BASE_URL = "https://www.opinet.co.kr/api";
const CACHE_TTL_MS = 2 * 60 * 1000;

const WGS84 = "EPSG:4326";
const KATECH =
  "+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +towgs84=-115.8,474.99,674.11,1.16,-2.31,-1.63,6.43 +units=m +no_defs";

type OpinetStation = {
  UNI_ID?: string;
  OS_NM?: string;
  POLL_DIV_CD?: string;
  PRICE?: string | number;
  DISTANCE?: string | number;
  GIS_X_COOR?: string | number;
  GIS_Y_COOR?: string | number;
  NEW_ADR?: string;
  VAN_ADR?: string;
};

type OpinetDetail = {
  UNI_ID?: string;
  OS_NM?: string;
  POLL_DIV_CD?: string;
  VAN_ADR?: string;
  NEW_ADR?: string;
  CAR_WASH_YN?: string;
  CVS_YN?: string;
  MAINT_YN?: string;
  TEL?: string;
};

function getApiKey(): string {
  const apiKey = process.env.OPINET_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPINET_API_KEY");
  }
  return apiKey;
}

async function callOpinet(path: string, params: URLSearchParams): Promise<unknown> {
  const apiKey = getApiKey();
  params.set("out", "json");
  params.set("code", apiKey);

  const url = `${OPINET_BASE_URL}/${path}?${params.toString()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Opinet request failed (${response.status})`);
  }

  return response.json();
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (value && typeof value === "object") {
    return [value as T];
  }
  return [];
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed.replaceAll(",", ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseDistanceMeters(distanceRaw: unknown): number {
  const km = numberOrNull(distanceRaw);
  if (km == null) {
    return 0;
  }
  return Math.round(km * 1000);
}

function parseBrand(raw: string | undefined): string {
  switch (raw) {
    case "SKE":
      return "SK";
    case "GSC":
      return "GS";
    case "HDO":
      return "HD";
    case "SOL":
      return "S-OIL";
    case "RTE":
      return "알뜰";
    case "RTX":
      return "고속알뜰";
    case "NHO":
      return "농협알뜰";
    case "ETC":
      return "무브랜드";
    case "E1G":
      return "E1";
    case "SKG":
      return "SK가스";
    default:
      return "기타";
  }
}

function toWgs84IfKatech(x: number | null, y: number | null): { lat: number | null; lng: number | null } {
  if (x == null || y == null) {
    return { lat: null, lng: null };
  }

  try {
    const [lng, lat] = proj4(KATECH, WGS84, [x, y]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { lat: null, lng: null };
    }
    return { lat, lng };
  } catch {
    return { lat: null, lng: null };
  }
}

function stationRowsFromPayload(payload: unknown): OpinetStation[] {
  const result = payload as { RESULT?: { OIL?: unknown } };
  return asArray<OpinetStation>(result?.RESULT?.OIL);
}

function detailRowFromPayload(payload: unknown): OpinetDetail | null {
  const result = payload as { RESULT?: { OIL?: unknown } };
  const rows = asArray<OpinetDetail>(result?.RESULT?.OIL);
  return rows[0] ?? null;
}

function avgRowsFromPayload(payload: unknown): Array<Record<string, unknown>> {
  const result = payload as { RESULT?: { OIL?: unknown } };
  return asArray<Record<string, unknown>>(result?.RESULT?.OIL);
}

function mapStationRows(rows: OpinetStation[]): StationCard[] {
  const priced = rows
    .map<StationCard | null>((row) => {
      const price = numberOrNull(row.PRICE);
      if (price == null || price <= 0) {
        return null;
      }

      const x = numberOrNull(row.GIS_X_COOR);
      const y = numberOrNull(row.GIS_Y_COOR);
      const geo = toWgs84IfKatech(x, y);

      return {
        id: row.UNI_ID ?? "",
        name: row.OS_NM ?? "이름 없음",
        brand: parseBrand(row.POLL_DIV_CD),
        price,
        distanceM: parseDistanceMeters(row.DISTANCE),
        isLowest: false,
        address: row.NEW_ADR || row.VAN_ADR || "주소 정보 없음",
        lat: geo.lat,
        lng: geo.lng,
      };
    })
    .filter((row): row is StationCard => row != null)
    .sort((a, b) => a.price - b.price);

  if (priced.length > 0) {
    priced[0].isLowest = true;
  }

  return priced;
}

async function fetchAroundAll(
  x: number,
  y: number,
  fuel: FuelCode,
  radius: number,
): Promise<StationCard[]> {
  const params = new URLSearchParams({
    x: String(x),
    y: String(y),
    radius: String(radius),
    prodcd: fuel,
    sort: "1",
  });

  const payload = await callOpinet("aroundAll.do", params);
  const rows = stationRowsFromPayload(payload);
  return mapStationRows(rows);
}

export async function fetchStationsWithFallback(
  lat: number,
  lng: number,
  fuel: FuelCode,
  radius: number,
): Promise<{ stations: StationCard[]; usedKatechFallback: boolean }> {
  // Step 1: Try direct WGS84 (in case Opinet endpoint accepts lon/lat).
  try {
    const directStations = await fetchAroundAll(lng, lat, fuel, radius);
    if (directStations.length > 0) {
      return { stations: directStations, usedKatechFallback: false };
    }
  } catch {
    // Ignore and fallback below.
  }

  // Step 2: Fallback to KATECH conversion.
  const [katechX, katechY] = proj4(WGS84, KATECH, [lng, lat]);
  const katechStations = await fetchAroundAll(katechX, katechY, fuel, radius);
  return { stations: katechStations, usedKatechFallback: true };
}

export async function fetchAveragePrice(
  fuel: FuelCode,
  regionCode: string,
): Promise<AvgPriceResponse> {
  const params = new URLSearchParams({
    prodcd: fuel,
    sido: regionCode,
  });

  const payload = await callOpinet("avgRecentPrice.do", params);
  const rows = avgRowsFromPayload(payload);

  const first = rows[0] ?? {};
  const avgPrice =
    numberOrNull(first.AVG_PRICE) ??
    numberOrNull(first.PRICE) ??
    numberOrNull(first.price) ??
    0;

  return {
    avgPrice,
    fuel,
    regionCode,
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchStationDetail(stationId: string): Promise<StationDetailResponse | null> {
  const params = new URLSearchParams({
    id: stationId,
  });

  const payload = await callOpinet("detailById.do", params);
  const detail = detailRowFromPayload(payload);

  if (!detail) {
    return null;
  }

  return {
    id: detail.UNI_ID ?? stationId,
    name: detail.OS_NM ?? "이름 없음",
    address: detail.NEW_ADR || detail.VAN_ADR || "주소 정보 없음",
    brand: parseBrand(detail.POLL_DIV_CD),
    hasCarWash: detail.CAR_WASH_YN === "Y",
    hasConvenienceStore: detail.CVS_YN === "Y",
    hasMaintenance: detail.MAINT_YN === "Y",
    tel: detail.TEL ?? null,
  };
}

export function computePriceInsight(stations: StationCard[], avgPrice: number): PriceInsight {
  const best = stations[0]?.price ?? 0;
  const normalizedAvg = avgPrice > 0 ? avgPrice : best;
  const savingsWon = Math.max(0, Math.round(normalizedAvg - best));
  const message =
    savingsWon > 0
      ? `평균보다 ${savingsWon.toLocaleString()}원 아낄 수 있어요`
      : "지금 확인한 주변 최저가예요";

  return {
    avgPrice: normalizedAvg,
    bestPrice: best,
    savingsWon,
    message,
    updatedAt: new Date().toISOString(),
  };
}

export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clampRadius(radius: number): number {
  return Math.max(500, Math.min(5000, Math.round(radius)));
}

export function getCacheTtlMs(): number {
  return CACHE_TTL_MS;
}

export function buildStationsResponse(
  stations: StationCard[],
  insight: PriceInsight,
  source: StationsResponse["source"],
): StationsResponse {
  return {
    stations,
    insight,
    source,
  };
}
