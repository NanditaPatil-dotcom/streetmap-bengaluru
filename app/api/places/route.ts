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

    const query: Record<string, unknown> = {};

    if (category && category !== "normal") {
      query.category = category;
    }

    if (area) {
      query.area = area.trim().toLowerCase();
    }

    if (mode) {
      const modeTags: Record<string, string[]> = {
        morning: ["breakfast", "park", "gym"],
        noon: ["lunch", "work"],
        evening: ["snacks", "dessert"],
        night: ["dinner", "late-night"],
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
