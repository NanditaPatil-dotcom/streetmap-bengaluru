import connectDB from "@/lib/mongodb";
import Place from "@/models/Place";
import { NextResponse } from "next/server";

export async function GET(req) {
  await connectDB();

  const places = await Place.find();

  return NextResponse.json(places);
}