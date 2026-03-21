import connectDB from "@/lib/mongodb";
import Place from "@/models/Place";
import { NextRequest, NextResponse } from "next/server";

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

    const body = await req.json();

    // Prevent duplicates — if a place with the same OSM id already exists, return it
    if (body.osmId) {
      const existing = await Place.findOne({ osmId: body.osmId });
      if (existing) return NextResponse.json(existing);
    }

    const place = await Place.create({
      name: body.name,
      category: body.category || "place",
      area: body.area || "",
      rating: typeof body.rating === "number" ? body.rating : 0,
      location: {
        type: "Point",
        coordinates: [body.lng, body.lat], // [lng, lat] — GeoJSON order
      },
      description: body.description || "",
      tags: body.tags || [],
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
