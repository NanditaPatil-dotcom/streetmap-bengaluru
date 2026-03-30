import connectDB from "@/lib/mongodb";
import Place from "@/models/Place";
import { authOptions } from "@/lib/auth";
import { sanitizePlaceForClient } from "@/lib/sanitizePlaceForClient";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_CATEGORY_TAGS: Record<string, string[]> = {
  cafe: ["breakfast", "snacks"],
  park: ["breakfast", "snacks"],
  restaurant: ["lunch", "late-night"],
  bakery: ["breakfast", "snacks"],
  coworking: ["work"],
  library: ["work"],
  nightlife: ["late-night"],
};

const normalizeCategory = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
};

const MIN_AREA_RESULTS = 3;
const DEFAULT_NEARBY_RADIUS_METRES = 3500;

const toNumber = (value: string | null) => {
  if (!value) {
    return null;
  }

  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
};

const buildBaseQuery = ({
  category,
  openNow,
  rating,
  tag,
  mode,
}: {
  category: string | null;
  openNow: string | null;
  rating: string | null;
  tag: string | null;
  mode: string | null;
}) => {
  const query: Record<string, unknown> = {};
  const andConditions: Record<string, unknown>[] = [];

  if (category && category !== "normal") {
    query.category = category;
  }

  if (tag) {
    andConditions.push({ tags: tag.trim().toLowerCase() });
  }

  if (mode) {
    const modeTags: Record<string, string[]> = {
      morning: ["breakfast", "park", "gym", "tea"],
      noon: ["lunch", "work", "tea"],
      evening: ["snacks", "dessert", "park"],
      night: ["dinner", "late-night", "pub", "bar"],
    };

    const tags = modeTags[mode];

    if (tags?.length) {
      andConditions.push({ tags: { $in: tags } });
    }
  }

  if (openNow === "true") {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    query.openTime = { $lte: currentTime };
    query.closeTime = { $gte: currentTime };
  }

  if (rating) {
    const minRating = Number(rating);

    if (!Number.isNaN(minRating)) {
      query.rating = { $gte: minRating };
    }
  }

  if (andConditions.length === 1) {
    Object.assign(query, andConditions[0]);
  }

  if (andConditions.length > 1) {
    query.$and = andConditions;
  }

  return query;
};

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const session = await getServerSession(authOptions);
    const viewerId = session?.user?.id ?? null;

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const mode = searchParams.get("mode");
    const area = searchParams.get("area");
    const areaLabel = searchParams.get("areaLabel");
    const openNow = searchParams.get("openNow");
    const tag = searchParams.get("tag");
    const rating = searchParams.get("rating");
    const areaLat = toNumber(searchParams.get("areaLat"));
    const areaLng = toNumber(searchParams.get("areaLng"));
    const minLat = toNumber(searchParams.get("minLat"));
    const minLng = toNumber(searchParams.get("minLng"));
    const maxLat = toNumber(searchParams.get("maxLat"));
    const maxLng = toNumber(searchParams.get("maxLng"));

    const query = buildBaseQuery({ category, openNow, rating, tag, mode });
    const hasAreaBounds =
      minLat !== null && minLng !== null && maxLat !== null && maxLng !== null;
    const hasAreaCenter = areaLat !== null && areaLng !== null;

    if ((hasAreaBounds || hasAreaCenter) && areaLabel) {
      let exactPlaces: unknown[] = [];

      if (hasAreaBounds) {
        exactPlaces = await Place.find({
          ...query,
          location: {
            $geoWithin: {
              $box: [
                [minLng, minLat],
                [maxLng, maxLat],
              ],
            },
          },
        }).lean();
      }

      if (!hasAreaBounds && hasAreaCenter) {
        exactPlaces = await Place.find({
          ...query,
          location: {
            $nearSphere: {
              $geometry: {
                type: "Point",
                coordinates: [areaLng, areaLat],
              },
              $maxDistance: DEFAULT_NEARBY_RADIUS_METRES,
            },
          },
        })
          .limit(MIN_AREA_RESULTS)
          .lean();
      }

      if (exactPlaces.length >= MIN_AREA_RESULTS) {
        return NextResponse.json({
          places: exactPlaces.map((item) => sanitizePlaceForClient(item, viewerId)),
          meta: {
            area: {
              kind: "exact",
              label: areaLabel,
              resultCount: exactPlaces.length,
              message: `Showing places documented in ${areaLabel}.`,
            },
          },
        });
      }

      if (hasAreaCenter) {
        const nearbyPlaces = await Place.find({
          ...query,
          location: {
            $nearSphere: {
              $geometry: {
                type: "Point",
                coordinates: [areaLng, areaLat],
              },
              $maxDistance: DEFAULT_NEARBY_RADIUS_METRES,
            },
          },
        })
          .limit(24)
          .lean();

        if (nearbyPlaces.length > 0) {
          return NextResponse.json({
            places: nearbyPlaces.map((item) => sanitizePlaceForClient(item, viewerId)),
            meta: {
              area: {
                kind: exactPlaces.length > 0 ? "nearby" : "empty",
                label: areaLabel,
                resultCount: nearbyPlaces.length,
                message:
                  exactPlaces.length > 0
                    ? `Only a few places are documented in ${areaLabel}, so we widened to nearby areas.`
                    : `Not many places are documented in ${areaLabel} yet. Showing nearby results instead.`,
              },
            },
          });
        }
      }

      return NextResponse.json({
        places: [],
        meta: {
          area: {
            kind: "empty",
            label: areaLabel,
            resultCount: 0,
            message: `No saved places are documented in ${areaLabel} yet.`,
          },
        },
      });
    }

    if (area) {
      const areas = area
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);

      if (areas.length === 1) {
        query.area = areas[0];
      }

      if (areas.length > 1) {
        query.area = { $in: areas };
      }
    }

    const places = await Place.find(query).lean();

    return NextResponse.json({
      places: places.map((item) => sanitizePlaceForClient(item, viewerId)),
      meta: null,
    });
  } catch (error) {
    console.error("Failed to fetch places", error);
    return NextResponse.json(
      { error: "Failed to fetch places" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();

    const session = await getServerSession(authOptions);
    const body = await req.json();
    const userId = session?.user?.id ?? "";
    const sessionName = session?.user?.name?.trim() ?? "";
    const addedBy = sessionName ? sessionName.split(" ")[0] : "";
    const initialRating = typeof body.rating === "number" ? body.rating : 0;
    const normalizedCategory = normalizeCategory(body.category);
    const inferredTags =
      Array.isArray(body.tags) && body.tags.length > 0
        ? body.tags
            .filter((tag: unknown): tag is string => typeof tag === "string" && tag.trim().length > 0)
            .map((tag) => tag.trim().toLowerCase())
        : DEFAULT_CATEGORY_TAGS[normalizedCategory] || [];
    const initialReview =
      initialRating > 0 && typeof body.description === "string" && body.description.trim()
        ? [
            {
              userId,
              text: body.description.trim(),
              author: addedBy || "Explorer",
              rating: initialRating,
            },
          ]
        : [];
    const creatorReview = initialReview.length ? initialReview[0] : null;
    const placeName = typeof body.name === "string" ? body.name.trim() : "";
    const lat = typeof body.lat === "number" ? body.lat : Number(body.lat);
    const lng = typeof body.lng === "number" ? body.lng : Number(body.lng);

    if (!placeName) {
      return NextResponse.json({ error: "Place name is required." }, { status: 400 });
    }

    if (!normalizedCategory) {
      return NextResponse.json({ error: "Place category is required." }, { status: 400 });
    }

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ error: "A valid location is required." }, { status: 400 });
    }

    // Prevent duplicates — if a place with the same OSM id already exists, return it
    if (body.osmId) {
      const existing = await Place.findOne({ osmId: body.osmId });
      if (existing) {
        const hasFallbackAddedBy =
          typeof existing.addedBy !== "string" ||
          !existing.addedBy.trim() ||
          existing.addedBy.trim().toLowerCase() === "user";

        if (addedBy && hasFallbackAddedBy) {
          existing.addedBy = addedBy;
          await existing.save();
        }

        return NextResponse.json(sanitizePlaceForClient(existing.toObject(), session?.user?.id ?? null));
      }
    }

    const place = await Place.create({
      name: placeName,
      category: normalizedCategory,
      addedBy: addedBy || (typeof body.addedBy === "string" && body.addedBy.trim() ? body.addedBy.trim() : "user"),
      area: body.area || "",
      rating: initialRating,
      location: {
        type: "Point",
        coordinates: [lng, lat], // [lng, lat] — GeoJSON order
      },
      description: body.description || "",
      tags: inferredTags,
      creatorReview,
      reviews: initialReview,
      osmId: body.osmId || null,
    });

    return NextResponse.json(sanitizePlaceForClient(place.toObject(), session?.user?.id ?? null), { status: 201 });
  } catch (error) {
    console.error("Failed to save place", error);

    const message =
      error instanceof Error ? error.message : "Failed to save place.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
