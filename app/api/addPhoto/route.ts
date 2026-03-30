import connectDB from "@/lib/mongodb";
import Place from "@/models/Place";
import { authOptions } from "@/lib/auth";
import { sanitizePlaceForClient } from "@/lib/sanitizePlaceForClient";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    await connectDB();

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ?? "";
    const author = session?.user?.name?.trim()?.split(" ")[0] || "Explorer";
    const body: { placeId?: unknown; images?: unknown } = await req.json();
    const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
    const images = Array.isArray(body.images)
      ? body.images.filter((image: unknown): image is string => typeof image === "string" && image.trim().length > 0)
      : [];

    if (!userId) {
      return NextResponse.json({ error: "Sign in to add photos." }, { status: 401 });
    }

    if (!placeId) {
      return NextResponse.json({ error: "placeId is required." }, { status: 400 });
    }

    if (!images.length) {
      return NextResponse.json({ error: "At least one photo is required." }, { status: 400 });
    }

    const updatedPlace = await Place.findByIdAndUpdate(
      placeId,
      {
        $push: {
          photos: {
            $each: images.map((image: string) => ({
              url: image,
              author,
              userId,
              createdAt: new Date(),
            })),
          },
        },
      },
      { new: true }
    ).lean();

    if (!updatedPlace) {
      return NextResponse.json({ error: "Place not found." }, { status: 404 });
    }

    return NextResponse.json({ place: sanitizePlaceForClient(updatedPlace, userId) });
  } catch (error) {
    console.error("Failed to add photos", error);
    const message = error instanceof Error ? error.message : "Failed to add photos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
