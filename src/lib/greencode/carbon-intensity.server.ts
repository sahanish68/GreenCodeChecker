/**
 * CarbonIntensityProvider abstraction.
 *
 * If CARBON_API_KEY is set, live data is fetched from the Electricity Maps
 * carbon-intensity API. Otherwise a documented annual-average fallback dataset
 * is used and the result is explicitly marked as NOT live.
 */
import { findRegion, GLOBAL_FALLBACK, type RegionInfo } from "./regions";

export interface IntensityResult {
  intensity: number;
  source: string;
  isLive: boolean;
  updatedAt: string;
  region: RegionInfo;
}

export async function getCurrentIntensity(regionId: string | null): Promise<IntensityResult> {
  const region = regionId ? findRegion(regionId) : GLOBAL_FALLBACK;
  const fallback: IntensityResult = {
    intensity: region.intensity,
    source: "Annual average grid intensity (public grid datasets) — estimated, not live",
    isLive: false,
    updatedAt: new Date().toISOString(),
    region,
  };

  const apiKey = process.env["CARBON_API_KEY"];
  if (!apiKey || region.zone === "WORLD") return fallback;

  try {
    const res = await fetch(
      `https://api.electricitymap.org/v3/carbon-intensity/latest?zone=${encodeURIComponent(region.zone)}`,
      { headers: { "auth-token": apiKey } },
    );
    if (!res.ok) return fallback;
    const json = (await res.json()) as { carbonIntensity?: number; datetime?: string };
    if (typeof json.carbonIntensity !== "number") return fallback;
    return {
      intensity: json.carbonIntensity,
      source: `Electricity Maps live data for zone ${region.zone}`,
      isLive: true,
      updatedAt: json.datetime ?? new Date().toISOString(),
      region,
    };
  } catch {
    return fallback;
  }
}

export function getRegionMetadata(regionId: string | null) {
  return findRegion(regionId);
}
