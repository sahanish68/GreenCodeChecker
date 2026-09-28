/**
 * Fallback grid carbon-intensity dataset (annual average gCO2e/kWh).
 *
 * Source: publicly published national/regional grid averages (Ember Global
 * Electricity Review + national grid operators). These are ANNUAL AVERAGES,
 * not live data. When CARBON_API_KEY is configured the provider queries a live
 * carbon-intensity API instead and the result is marked as "live".
 *
 * Extensible by design: add a row here to support another region.
 */

export type CloudProvider = "AWS" | "GCP" | "Azure" | "Unknown";

export interface RegionInfo {
  id: string;
  provider: CloudProvider;
  label: string;
  country: string;
  /** Annual average grid carbon intensity, gCO2e/kWh */
  intensity: number;
  /** Power usage effectiveness assumption for the data centre */
  pue: number;
  /** Electricity Maps zone key, used when a live API key is available */
  zone: string;
  notes: string;
}

export const REGIONS: RegionInfo[] = [
  { id: "us-east-1", provider: "AWS", label: "US East (N. Virginia)", country: "United States", intensity: 340, pue: 1.15, zone: "US-MIDA-PJM", notes: "Largest AWS region; mixed gas/nuclear grid." },
  { id: "us-east-2", provider: "AWS", label: "US East (Ohio)", country: "United States", intensity: 430, pue: 1.15, zone: "US-MIDW-MISO", notes: "Higher coal share on the regional grid." },
  { id: "us-west-1", provider: "AWS", label: "US West (N. California)", country: "United States", intensity: 220, pue: 1.15, zone: "US-CAL-CISO", notes: "High solar share, intensity varies a lot by hour." },
  { id: "us-west-2", provider: "AWS", label: "US West (Oregon)", country: "United States", intensity: 120, pue: 1.13, zone: "US-NW-PACW", notes: "Hydro-dominated grid." },
  { id: "ca-central-1", provider: "AWS", label: "Canada (Central)", country: "Canada", intensity: 130, pue: 1.15, zone: "CA-ON", notes: "Nuclear and hydro heavy." },
  { id: "eu-west-1", provider: "AWS", label: "Europe (Ireland)", country: "Ireland", intensity: 290, pue: 1.12, zone: "IE", notes: "Large wind share, gas backup." },
  { id: "eu-west-2", provider: "AWS", label: "Europe (London)", country: "United Kingdom", intensity: 230, pue: 1.12, zone: "GB", notes: "Wind plus gas." },
  { id: "eu-west-3", provider: "AWS", label: "Europe (Paris)", country: "France", intensity: 60, pue: 1.12, zone: "FR", notes: "Nuclear dominated grid." },
  { id: "eu-central-1", provider: "AWS", label: "Europe (Frankfurt)", country: "Germany", intensity: 350, pue: 1.13, zone: "DE", notes: "Renewables growing, coal/gas still present." },
  { id: "eu-north-1", provider: "AWS", label: "Europe (Stockholm)", country: "Sweden", intensity: 45, pue: 1.1, zone: "SE", notes: "Hydro, nuclear and wind." },
  { id: "ap-south-1", provider: "AWS", label: "Asia Pacific (Mumbai)", country: "India", intensity: 630, pue: 1.25, zone: "IN-WE", notes: "Coal heavy grid, higher cooling demand." },
  { id: "ap-southeast-1", provider: "AWS", label: "Asia Pacific (Singapore)", country: "Singapore", intensity: 410, pue: 1.3, zone: "SG", notes: "Gas grid, tropical cooling overhead." },
  { id: "ap-southeast-2", provider: "AWS", label: "Asia Pacific (Sydney)", country: "Australia", intensity: 500, pue: 1.2, zone: "AU-NSW", notes: "Coal share declining." },
  { id: "ap-northeast-1", provider: "AWS", label: "Asia Pacific (Tokyo)", country: "Japan", intensity: 460, pue: 1.2, zone: "JP-TK", notes: "Gas and coal mix." },
  { id: "sa-east-1", provider: "AWS", label: "South America (São Paulo)", country: "Brazil", intensity: 100, pue: 1.2, zone: "BR-CS", notes: "Hydro dominated." },
  { id: "us-central1", provider: "GCP", label: "GCP us-central1 (Iowa)", country: "United States", intensity: 400, pue: 1.1, zone: "US-MIDW-MISO", notes: "Wind share rising in the region." },
  { id: "europe-west1", provider: "GCP", label: "GCP europe-west1 (Belgium)", country: "Belgium", intensity: 170, pue: 1.1, zone: "BE", notes: "Nuclear and wind." },
  { id: "westeurope", provider: "Azure", label: "Azure West Europe (Netherlands)", country: "Netherlands", intensity: 300, pue: 1.15, zone: "NL", notes: "Gas and wind mix." },
  { id: "eastus", provider: "Azure", label: "Azure East US (Virginia)", country: "United States", intensity: 340, pue: 1.15, zone: "US-MIDA-PJM", notes: "Same grid as AWS us-east-1." },
];

/** Global average used when no region can be detected. */
export const GLOBAL_FALLBACK: RegionInfo = {
  id: "global-average",
  provider: "Unknown",
  label: "Global average (no region detected)",
  country: "World",
  intensity: 480,
  pue: 1.2,
  zone: "WORLD",
  notes: "World average grid intensity, used when no deployment region is found.",
};

export function findRegion(id: string | null | undefined): RegionInfo {
  if (!id) return GLOBAL_FALLBACK;
  return REGIONS.find((r) => r.id.toLowerCase() === id.toLowerCase()) ?? GLOBAL_FALLBACK;
}
