import connectDB from "@/lib/mongodb";
import Place from "@/models/Place";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    await connectDB();

    const body = await req.json();
    const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
    const images = Array.isArray(body.images)
      ? body.images.filter((image): image is string => typeof image === "string" && image.trim().length > 0)
      : [];

    if (!placeId) {
      return NextResponse.json({ error: "placeId is required." }, { status: 400 });
    }

    if (!images.length) {
      return NextResponse.json({ error: "At least one menu image is required." }, { status: 400 });
    }

    const updatedPlace = await Place.findByIdAndUpdate(
      placeId,
      { $push: { menuImages: { $each: images } } },
      { new: true }
    ).lean();

    if (!updatedPlace) {
      return NextResponse.json({ error: "Place not found." }, { status: 404 });
    }

    return NextResponse.json({ place: updatedPlace });
  } catch (error) {
    console.error("Failed to add menu images", error);
    const message = error instanceof Error ? error.message : "Failed to add menu images.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
