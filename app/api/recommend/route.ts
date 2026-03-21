import connectDB from "@/lib/mongodb";
import Place from "@/models/Place";
import { NextResponse } from "next/server";

type RecommendRequestBody = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  category?: string;
  mood?: string;
  mode?: string;
  count?: number;
};

type MatchQuery = {
  category?: string | { $nin: string[] };
  tags?: { $in: string[] };
};

type RecommendedPlace = {
  _id: { toString(): string } | string;
  rating?: number;
  distance?: number | null;
  [key: string]: unknown;
};

// Fisher-Yates shuffle — true randomness for regenerate
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function POST(req: Request) {
  await connectDB();

  const body = (await req.json()) as RecommendRequestBody;
  const {
    lat,
    lng,
    radiusKm = 50,       // default: anywhere in Bengaluru
    category,
    mood,
    mode,
    count = 3,
  } = body;

  // ── Mood → tags mapping ────────────────────────────────────────────────────
  const moodTagMap: Record<string, string[]> = {
    "need-coffee":    ["coffee", "breakfast", "cafe"],
    "touch-grass":    ["park", "outdoor", "scenic", "garden"],
    "late-night":     ["late-night", "dinner", "bar", "nightlife"],
    "hidden-gem":     ["hidden-gem", "local", "lesser-known"],
    "quick-bite":     ["quick-bite", "takeaway", "snacks"],
    "just-vibing":    [],  // no tag filter, open to anything
  };

  // ── Mode → tags mapping ────────────────────────────────────────────────────
  const modeTagMap: Record<string, string[]> = {
    morning: ["breakfast", "coffee", "park", "gym"],
    noon:    ["lunch", "work", "cafe"],
    evening: ["snacks", "dessert", "bakery"],
    night:   ["dinner", "late-night", "bar"],
  };

  const excludedCategories = ["metro", "bmtc"];

  // ── Base match filters (category, tags) ───────────────────────────────────
  const matchQuery: MatchQuery = {};
  matchQuery.category = { $nin: excludedCategories };

  if (category && category !== "any" && !excludedCategories.includes(category)) {
    matchQuery.category = category;
  }

  const tagFilters: string[] = [];
  if (mood && moodTagMap[mood]) tagFilters.push(...moodTagMap[mood]);
  if (mode && modeTagMap[mode]) tagFilters.push(...modeTagMap[mode]);
  if (tagFilters.length > 0) matchQuery.tags = { $in: tagFilters };

  // ── Use $geoNear if user location is provided, else plain find ─────────────
  let places: RecommendedPlace[] = [];

  const hasLocation =
    typeof lat === "number" &&
    typeof lng === "number" &&
    !isNaN(lat) &&
    !isNaN(lng);

  if (hasLocation) {
    // $geoNear MUST be the first stage in aggregation
    // distanceField will add a "distance" key (in metres) to each doc
    const pipeline = [
      {
        $geoNear: {
          near: { type: "Point", coordinates: [lng, lat] },
          distanceField: "distance",
          maxDistance: radiusKm * 1000, // convert km → metres
          spherical: true,
          query: matchQuery,
        },
      },
      { $limit: 50 }, // cap the pool before shuffling
    ];

    places = (await Place.aggregate(pipeline)) as RecommendedPlace[];
  } else {
    // No geolocation — plain find with tag/category filters
    places = (await Place.find(matchQuery).limit(50).lean()) as RecommendedPlace[];
    // Add a dummy distance so the card renderer doesn't crash
    places = places.map((p) => ({ ...p, distance: null }));
  }

  // ── Fallback: if filters returned nothing, loosen them ───────────────────
  if (places.length === 0) {
    if (hasLocation) {
      // Try again with only radius, drop tag/category filters
      const fallbackPipeline = [
        {
          $geoNear: {
            near: { type: "Point", coordinates: [lng, lat] },
            distanceField: "distance",
            maxDistance: radiusKm * 1000,
            spherical: true,
            query: { category: { $nin: excludedCategories } },
          },
        },
        { $limit: 50 },
      ];
      places = (await Place.aggregate(fallbackPipeline)) as RecommendedPlace[];
    } else {
      // Absolute fallback: just return any places
      places = (await Place.find({ category: { $nin: excludedCategories } }).limit(50).lean()) as RecommendedPlace[];
      places = places.map((p) => ({ ...p, distance: null }));
    }
  }

  if (places.length === 0) {
    return NextResponse.json({ error: "No places found in the database." }, { status: 404 });
  }

  // ── Shuffle and return `count` results ─────────────────────────────────────
  // Weighted by rating so higher-rated places appear more often
  const weighted: RecommendedPlace[] = [];
  for (const p of places) {
    const weight = Math.max(1, Math.round((p.rating || 3) * 2));
    for (let i = 0; i < weight; i++) weighted.push(p);
  }

  const shuffled = shuffle(weighted);

  // Deduplicate by _id after weighting
  const seen = new Set<string>();
  const unique: RecommendedPlace[] = [];
  for (const p of shuffled) {
    const id = typeof p._id === "string" ? p._id : p._id.toString();
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(p);
    }
    if (unique.length >= count) break;
  }

  return NextResponse.json(unique);
}
