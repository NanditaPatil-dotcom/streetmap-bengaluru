import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/mongodb';
import Place from '../../../models/Place';

export async function GET() {
  try {
    await dbConnect();

    const places = await Place.find({});

    return NextResponse.json({ places }, { status: 200 });
  } catch (error) {
    console.error('Error fetching places:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}