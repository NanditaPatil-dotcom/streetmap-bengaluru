import { NextResponse } from "next/server";

type NominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  addresstype?: string;
  name?: string;
  namedetails?: Record<string, string>;
  extratags?: Record<string, string>;
};

const ROAD_TERMS = ["road", "street", "main road", "cross", "layout", "stage", "phase"];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function candidateName(result: NominatimResult) {
  return (
    result.name ||
    result.namedetails?.name ||
    result.namedetails?.["name:en"] ||
    result.namedetails?.brand ||
    result.extratags?.brand ||
    result.extratags?.name ||
    result.display_name.split(",")[0]
  );
}

function scoreResult(result: NominatimResult, query: string) {
  const normalizedQuery = normalize(query);
  const normalizedName = normalize(candidateName(result));
  const normalizedDisplay = normalize(result.display_name);
  const queryLooksLikeRoad = ROAD_TERMS.some((term) => normalizedQuery.includes(term));

  let score = 0;

  if (normalizedName === normalizedQuery) score += 120;
  else if (normalizedName.startsWith(normalizedQuery)) score += 90;
  else if (normalizedName.includes(normalizedQuery)) score += 70;

  if (normalizedDisplay.includes(normalizedQuery)) score += 20;

  if (result.class && ["amenity", "shop", "tourism", "leisure", "office"].includes(result.class)) {
    score += 35;
  }

  if (result.type && ["cafe", "restaurant", "mall", "supermarket", "pub", "bar", "park"].includes(result.type)) {
    score += 30;
  }

  if (!queryLooksLikeRoad && (result.class === "highway" || result.addresstype === "road")) {
    score -= 60;
  }

  return score;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length < 2) {
    return NextResponse.json([]);
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", `${q}, Bengaluru, India`);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("namedetails", "1");
    url.searchParams.set("extratags", "1");
    url.searchParams.set("dedupe", "1");
    url.searchParams.set("limit", "10");
    url.searchParams.set("accept-language", "en");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "StreetMapBengaluru/1.0 (fosshack)",
        "Accept": "application/json",
      },
      next: { revalidate: 60 }, // cache identical queries for 60s
    });

    if (!res.ok) {
      return NextResponse.json([]);
    }

    const data = (await res.json()) as NominatimResult[];
    const ranked = data
      .map((result) => ({ result, score: scoreResult(result, q) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ result }) => result);

    return NextResponse.json(ranked);
  } catch (err) {
    console.error("Geocode proxy error:", err);
    return NextResponse.json([]);
  }
}
