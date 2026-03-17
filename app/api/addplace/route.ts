import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Place from '../../../models/Place';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const { name, description, latitude, longitude, category, address } = await request.json();

    if (!name || !description || !latitude || !longitude || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newPlace = new Place({
      name,
      description,
      latitude,
      longitude,
      category,
      address,
    });

    const savedPlace = await newPlace.save();

    return NextResponse.json({ message: 'Place added successfully', place: savedPlace }, { status: 201 });
  } catch (error) {
    console.error('Error adding place:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}