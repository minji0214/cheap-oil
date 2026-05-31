"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Settings2,
} from "lucide-react";
import type { FuelCode, StationCard, StationsResponse } from "@/lib/types";

type RegionOption = {
  code: string;
  label: string;
  lat: number;
  lng: number;
};

const REGION_OPTIONS: RegionOption[] = [
  { code: "11", label: "서울", lat: 37.5665, lng: 126.978 },
  { code: "26", label: "부산", lat: 35.1796, lng: 129.0756 },
  { code: "27", label: "대구", lat: 35.8714, lng: 128.6014 },
  { code: "28", label: "인천", lat: 37.4563, lng: 126.7052 },
  { code: "29", label: "광주", lat: 35.1595, lng: 126.8526 },
  { code: "30", label: "대전", lat: 36.3504, lng: 127.3845 },
  { code: "31", label: "울산", lat: 35.5384, lng: 129.3114 },
  { code: "41", label: "경기", lat: 37.4138, lng: 127.5183 },
  { code: "42", label: "강원", lat: 37.8228, lng: 128.1555 },
  { code: "43", label: "충북", lat: 36.8, lng: 127.7 },
  { code: "44", label: "충남", lat: 36.5184, lng: 126.8 },
  { code: "45", label: "전북", lat: 35.7175, lng: 127.153 },
  { code: "46", label: "전남", lat: 34.8161, lng: 126.4629 },
  { code: "47", label: "경북", lat: 36.576, lng: 128.5056 },
  { code: "48", label: "경남", lat: 35.4606, lng: 128.2132 },
  { code: "50", label: "제주", lat: 33.4996, lng: 126.5312 },
];

const BRAND_COLORS: Record<string, string> = {
  SK: "text-orange-500",
  GS: "text-green-600",
  "S-OIL": "text-yellow-600",
  HD: "text-sky-600",
  알뜰: "text-indigo-600",
  고속알뜰: "text-indigo-600",
  농협알뜰: "text-emerald-700",
  E1: "text-rose-500",
  SK가스: "text-orange-500",
};

function formatDistance(distanceM: number): string {
  return `${(distanceM / 1000).toFixed(1)}km 떨어짐`;
}

function formatUpdateTime(iso?: string): string {
  if (!iso) {
    return "업데이트 정보 없음";
  }

  try {
    const date = new Date(iso);
    return `${date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })} 업데이트`;
  } catch {
    return "업데이트 정보 없음";
  }
}

function getRegionCenter(code: string): RegionOption {
  return REGION_OPTIONS.find((item) => item.code === code) ?? REGION_OPTIONS[0];
}

function openTmapNavigation(name: string, lat: number | null, lng: number | null): void {
  if (lat == null || lng == null) {
    return;
  }

  const encoded = encodeURIComponent(name);
  const deepLink = `tmap://route?goalname=${encoded}&goalx=${lng}&goaly=${lat}`;
  const webFallback = `https://www.tmap.co.kr/tmap2/mobile/route.jsp?goalname=${encoded}&goalx=${lng}&goaly=${lat}`;

  let switched = false;
  const handleVisibility = () => {
    if (document.hidden) {
      switched = true;
    }
  };

  document.addEventListener("visibilitychange", handleVisibility);
  window.location.href = deepLink;

  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", handleVisibility);
    if (!switched) {
      window.location.href = webFallback;
    }
  }, 700);
}

type Coords = {
  lat: number;
  lng: number;
};

function readErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const maybeMessage = (payload as { message?: unknown }).message;
  return typeof maybeMessage === "string" ? maybeMessage : null;
}

export default function FuelIqApp() {
  const [fuelType, setFuelType] = useState<FuelCode>("B027");
  const [regionCode, setRegionCode] = useState("11");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationLabel, setLocationLabel] = useState("위치 확인 중");
  const [geoDenied, setGeoDenied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [stations, setStations] = useState<StationCard[]>([]);
  const [insightMessage, setInsightMessage] = useState("주변 가격을 불러오고 있어요");
  const [updatedAt, setUpdatedAt] = useState<string>("");

  const region = useMemo(() => getRegionCenter(regionCode), [regionCode]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      queueMicrotask(() => {
        setGeoDenied(true);
        setCoords({ lat: region.lat, lng: region.lng });
        setLocationLabel(`${region.label} (수동 선택)`);
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoDenied(false);
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationLabel("현재 위치");
      },
      () => {
        setGeoDenied(true);
        setCoords({ lat: region.lat, lng: region.lng });
        setLocationLabel(`${region.label} (수동 선택)`);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
      },
    );
  }, [region.lat, region.lng, region.label]);

  useEffect(() => {
    if (!coords) {
      return;
    }

    let cancelled = false;

    const fetchStations = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const params = new URLSearchParams({
          lat: String(coords.lat),
          lng: String(coords.lng),
          fuel: fuelType,
          radius: "3000",
          regionCode,
        });

        const response = await fetch(`/api/stations?${params.toString()}`);
        const data = (await response.json()) as unknown;

        if (!response.ok) {
          throw new Error(readErrorMessage(data) ?? "데이터를 가져오지 못했어요");
        }

        if (cancelled) {
          return;
        }

        const stationsResponse = data as StationsResponse;
        setStations(stationsResponse.stations);
        setInsightMessage(stationsResponse.insight.message);
        setUpdatedAt(stationsResponse.insight.updatedAt);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "오류가 발생했어요";
        setErrorMessage(message);
        setStations([]);
        setInsightMessage("데이터를 불러오지 못했어요");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchStations();

    return () => {
      cancelled = true;
    };
  }, [coords, fuelType, regionCode]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  const refresh = () => {
    if (!coords) {
      return;
    }

    setCoords({ ...coords });
  };

  const bottomStation = stations[0] ?? null;

  return (
    <div className="min-h-screen bg-[#F2F4F7] text-[#191F28] antialiased">
      {toast && (
        <div className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-full bg-[#191F28] px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      <nav className="sticky top-0 z-50 flex items-center justify-between bg-[#F2F4F7]/90 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-1 text-[#8B95A1]">
          <MapPin size={14} />
          <span className="text-sm font-medium">{locationLabel}</span>
        </div>
        <div className="flex gap-4">
          <button
            type="button"
            aria-label="검색 준비중"
            onClick={() => setToast("검색 기능은 준비 중이에요")}
            className="cursor-pointer"
          >
            <Search size={22} className="text-[#8B95A1]" />
          </button>
          <button
            type="button"
            aria-label="설정 준비중"
            onClick={() => setToast("설정 기능은 준비 중이에요")}
            className="cursor-pointer"
          >
            <Settings2 size={22} className="text-[#8B95A1]" />
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-lg px-6 pb-28">
        <section className="mb-8 mt-4">
          <h1 className="text-2xl font-bold leading-snug">
            지금 주유하면
            <br />
            <span className="text-[#3182F6]">{insightMessage}</span>
          </h1>
          <button
            type="button"
            onClick={refresh}
            className="mt-3 flex items-center gap-1 text-xs font-medium text-[#8B95A1]"
          >
            <RefreshCw size={12} />
            {formatUpdateTime(updatedAt)}
          </button>
        </section>

        {geoDenied && (
          <section className="mb-4 rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <p className="mb-3 text-sm font-semibold text-[#4E5968]">위치 권한이 없어 수동 지역을 사용 중이에요</p>
            <label htmlFor="regionCode" className="sr-only">
              지역 선택
            </label>
            <div className="relative">
              <select
                id="regionCode"
                className="w-full appearance-none rounded-xl border border-[#E5E8EB] bg-[#F9FAFB] px-3 py-2.5 text-sm font-semibold text-[#191F28]"
                value={regionCode}
                onChange={(event) => {
                  const nextCode = event.target.value;
                  setRegionCode(nextCode);
                  const nextRegion = getRegionCenter(nextCode);
                  setCoords({ lat: nextRegion.lat, lng: nextRegion.lng });
                  setLocationLabel(`${nextRegion.label} (수동 선택)`);
                }}
              >
                {REGION_OPTIONS.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-[#8B95A1]" />
            </div>
          </section>
        )}

        <div className="mb-8 flex rounded-xl bg-[#E5E8EB] p-1">
          <button
            type="button"
            onClick={() => setFuelType("B027")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-all ${
              fuelType === "B027"
                ? "bg-white text-[#3182F6] shadow-sm"
                : "text-[#4E5968]"
            }`}
          >
            휘발유
          </button>
          <button
            type="button"
            onClick={() => setFuelType("D047")}
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-all ${
              fuelType === "D047"
                ? "bg-white text-[#3182F6] shadow-sm"
                : "text-[#4E5968]"
            }`}
          >
            경유
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-medium text-rose-700">
            {errorMessage}
          </div>
        )}

        <div className="space-y-4">
          {isLoading
            ? [0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="animate-pulse rounded-[24px] bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
                >
                  <div className="mb-3 h-5 w-36 rounded bg-[#E5E8EB]" />
                  <div className="mb-6 h-3 w-56 rounded bg-[#EEF1F4]" />
                  <div className="h-8 w-20 rounded bg-[#E5E8EB]" />
                </div>
              ))
            : stations.map((station) => (
                <div
                  key={station.id}
                  className="cursor-pointer rounded-[24px] bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)] active:scale-[0.98]"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className={`text-[11px] font-black tracking-tighter ${
                            BRAND_COLORS[station.brand] ?? "text-[#8B95A1]"
                          }`}
                        >
                          {station.brand}
                        </span>
                        <h4 className="text-lg font-bold">{station.name}</h4>
                      </div>
                      <p className="text-xs text-[#8B95A1]">{station.address}</p>
                    </div>
                    {station.isLowest && (
                      <span className="rounded-full bg-[#E8F3FF] px-2.5 py-1 text-[11px] font-bold text-[#3182F6]">
                        최저가
                      </span>
                    )}
                  </div>

                  <div className="flex items-end justify-between border-t border-[#F2F4F7] pt-4">
                    <div>
                      <div className="flex items-baseline gap-0.5">
                        <span
                          className={`text-2xl font-extrabold ${
                            station.isLowest ? "text-[#3182F6]" : "text-[#191F28]"
                          }`}
                        >
                          {station.price.toLocaleString()}
                        </span>
                        <span className="text-sm font-bold text-[#8B95A1]">원</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#ADB5BD]">{formatDistance(station.distanceM)}</p>
                    </div>

                    <button
                      type="button"
                      className="flex items-center gap-1.5 rounded-xl bg-[#F2F4F7] px-4 py-2.5 transition-colors hover:bg-[#E5E8EB]"
                      onClick={() => openTmapNavigation(station.name, station.lat, station.lng)}
                    >
                      <Navigation size={16} className="text-[#4E5968]" fill="currentColor" />
                      <span className="text-sm font-bold text-[#4E5968]">길찾기</span>
                    </button>
                  </div>
                </div>
              ))}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-[#F2F4F7] via-[#F2F4F7] to-transparent p-6">
        <button
          type="button"
          onClick={() => openTmapNavigation(bottomStation?.name ?? "가까운 주유소", bottomStation?.lat ?? null, bottomStation?.lng ?? null)}
          className="mx-auto block w-full max-w-lg rounded-2xl bg-[#3182F6] py-4 text-lg font-bold text-white shadow-[0_12px_24px_rgba(49,130,246,0.3)] transition-all active:scale-[0.96]"
          disabled={!bottomStation}
        >
          가까운 주유소 지도보기
        </button>
      </div>
    </div>
  );
}
