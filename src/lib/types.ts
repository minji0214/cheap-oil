export const FUEL_CODES = ["B027", "D047"] as const;

export type FuelCode = (typeof FUEL_CODES)[number];

export type StationCard = {
  id: string;
  name: string;
  brand: string;
  price: number;
  distanceM: number;
  isLowest: boolean;
  address: string;
  lat: number | null;
  lng: number | null;
};

export type PriceInsight = {
  avgPrice: number;
  bestPrice: number;
  savingsWon: number;
  message: string;
  updatedAt: string;
};

export type StationsResponse = {
  stations: StationCard[];
  insight: PriceInsight;
  source: "opinet" | "fallback";
};

export type AvgPriceResponse = {
  avgPrice: number;
  fuel: FuelCode;
  regionCode: string;
  updatedAt: string;
};

export type StationDetailResponse = {
  id: string;
  name: string;
  address: string;
  brand: string;
  hasCarWash: boolean;
  hasConvenienceStore: boolean;
  hasMaintenance: boolean;
  tel: string | null;
};

export type ApiError = {
  code: string;
  message: string;
  retryable: boolean;
};
