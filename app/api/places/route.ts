import connectDB from "@/lib/mongodb";
import Place from "@/models/Place";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_CATEGORY_TAGS: Record<string, string[]> = {
  cafe: ["breakfast", "snacks"],
  park: ["breakfast", "snacks"],
  food: ["lunch", "late-night"],
  restaurant: ["lunch", "late-night"],
};

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const mode = searchParams.get("mode");
    const area = searchParams.get("area");
    const openNow = searchParams.get("openNow");
    const tag = searchParams.get("tag");
    const rating = searchParams.get("rating");

    const query: Record<string, unknown> = {};

    if (category && category !== "normal") {
      query.category = category;
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

    if (tag) {
      query.tags = tag.trim().toLowerCase();
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
        query.tags = { $in: tags };
      }
    }

    if (openNow === "true") {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

      query.openTime = { $lte: currentTime };
      query.closeTime = { $gte: currentTime };
    }

    if (rating) {
      const minRating = Number(rating);

      if (!Number.isNaN(minRating)) {
        query.rating = { $gte: minRating };
      }
    }

    const places = await Place.find(query).lean();

    return NextResponse.json(places);
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
    const sessionName = session?.user?.name?.trim() ?? "";
    const addedBy = sessionName ? sessionName.split(" ")[0] : "";
    const initialRating = typeof body.rating === "number" ? body.rating : 0;
    const inferredTags =
      Array.isArray(body.tags) && body.tags.length > 0
        ? body.tags
        : DEFAULT_CATEGORY_TAGS[body.category] || [];
    const initialReview =
      initialRating > 0 && typeof body.description === "string" && body.description.trim()
        ? [
            {
              text: body.description.trim(),
              author: addedBy || "Explorer",
              rating: initialRating,
            },
          ]
        : [];
    const creatorReview = initialReview.length ? initialReview[0] : null;

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

        return NextResponse.json(existing);
      }
    }

    const place = await Place.create({
      name: body.name,
      category: body.category || "place",
      addedBy: addedBy || (typeof body.addedBy === "string" && body.addedBy.trim() ? body.addedBy.trim() : "user"),
      area: body.area || "",
      rating: initialRating,
      location: {
        type: "Point",
        coordinates: [body.lng, body.lat], // [lng, lat] — GeoJSON order
      },
      description: body.description || "",
      tags: inferredTags,
      creatorReview,
      reviews: initialReview,
      osmId: body.osmId || null,
    });

    return NextResponse.json(place, { status: 201 });
  } catch (error) {
    console.error("Failed to save place", error);

    const message =
      error instanceof Error ? error.message : "Failed to save place.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
