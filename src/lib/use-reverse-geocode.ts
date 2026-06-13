import { useQuery } from "@tanstack/react-query";

export interface ReverseGeocodeResult {
  city: string | null;
  region: string | null; // state code or country
  display: string | null; // "City, RegionCode"
}

async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const json = await res.json();
  const a = json?.address ?? {};
  const city: string | null =
    a.city ?? a.town ?? a.municipality ?? a.village ?? a.hamlet ?? a.suburb ?? null;
  // Brazilian states come as ISO3166-2-lvl4 like "BR-SP" → "SP"
  let region: string | null = null;
  const iso = a["ISO3166-2-lvl4"] as string | undefined;
  if (iso && iso.includes("-")) region = iso.split("-")[1];
  if (!region) region = a.state_code ?? a.state ?? a.country_code?.toUpperCase() ?? a.country ?? null;
  const display = city ? (region ? `${city}, ${region}` : city) : null;
  return { city, region, display };
}

export function useReverseGeocode(lat: number | null | undefined, lng: number | null | undefined) {
  // Round to ~1.1 km grid to maximize cache hits across nearby calls
  const rLat = lat != null ? Math.round(lat * 100) / 100 : null;
  const rLng = lng != null ? Math.round(lng * 100) / 100 : null;
  return useQuery({
    queryKey: ["reverse-geocode", rLat, rLng],
    queryFn: () => reverseGeocode(rLat!, rLng!),
    enabled: rLat != null && rLng != null,
    staleTime: 1000 * 60 * 60 * 24, // 24h
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
  });
}
