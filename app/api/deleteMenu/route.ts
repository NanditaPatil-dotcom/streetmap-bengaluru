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
      return NextResponse.json({ error: "Sign in to delete menu images." }, { status: 401 });
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

    const targetMenuImage = Array.isArray(place.menuImages)
      ? place.menuImages.find((image: { _id?: { toString?: () => string } }) => image?._id?.toString?.() === mediaId)
      : null;

    if (!targetMenuImage) {
      return NextResponse.json({ error: "Menu image not found." }, { status: 404 });
    }

    const canDelete =
      (typeof targetMenuImage.userId === "string" && targetMenuImage.userId === userId) ||
      (!targetMenuImage.userId && displayUserName(targetMenuImage.author) === currentUserName);

    if (!canDelete) {
      return NextResponse.json({ error: "You can only delete your own menu images." }, { status: 403 });
    }

    place.menuImages = place.menuImages.filter(
      (image: { _id?: { toString?: () => string } }) => image?._id?.toString?.() !== mediaId
    );

    await place.save();

    return NextResponse.json({
      place: sanitizePlaceForClient(place.toObject(), userId),
    });
  } catch (error) {
    console.error("Failed to delete menu image", error);
    const message = error instanceof Error ? error.message : "Failed to delete menu image.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
