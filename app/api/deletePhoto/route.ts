import connectDB from "@/lib/mongodb";
import Place from "@/models/Place";
import { authOptions } from "@/lib/auth";
import { sanitizePlaceForClient } from "@/lib/sanitizePlaceForClient";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

const displayUserName = (value?: string | null) => value?.trim().split(" ")[0] || "";

export async function POST(req: Request) {
  try {
    await connectDB();

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ?? "";
    const currentUserName = displayUserName(session?.user?.name);

    if (!userId) {
      return NextResponse.json({ error: "Sign in to delete photos." }, { status: 401 });
    }

    const body = await req.json();
    const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
    const mediaId = typeof body.mediaId === "string" ? body.mediaId.trim() : "";

    if (!placeId || !mediaId) {
      return NextResponse.json({ error: "placeId and mediaId are required." }, { status: 400 });
    }

    const place = await Place.findById(placeId);

    if (!place) {
      return NextResponse.json({ error: "Place not found." }, { status: 404 });
    }

    const targetPhoto = Array.isArray(place.photos)
      ? place.photos.find((photo: { _id?: { toString?: () => string } }) => photo?._id?.toString?.() === mediaId)
      : null;

    if (!targetPhoto) {
      return NextResponse.json({ error: "Photo not found." }, { status: 404 });
    }

    const canDelete =
      (typeof targetPhoto.userId === "string" && targetPhoto.userId === userId) ||
      (!targetPhoto.userId && displayUserName(targetPhoto.author) === currentUserName);

    if (!canDelete) {
      return NextResponse.json({ error: "You can only delete your own photos." }, { status: 403 });
    }

    place.photos = place.photos.filter(
      (photo: { _id?: { toString?: () => string } }) => photo?._id?.toString?.() !== mediaId
    );

    await place.save();

    return NextResponse.json({
      place: sanitizePlaceForClient(place.toObject(), userId),
    });
  } catch (error) {
    console.error("Failed to delete photo", error);
    const message = error instanceof Error ? error.message : "Failed to delete photo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
