import mongoose from "mongoose";

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongoose: MongooseCache | undefined;
}

const cached: MongooseCache =
  global.mongoose ?? (global.mongoose = { conn: null, promise: null });

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const mongodbUri = process.env.MONGODB_URI;

    if (!mongodbUri) {
      throw new ConfigurationError("MONGODB_URI is not configured.");
    }

    cached.promise = mongoose.connect(mongodbUri, {
      dbName: "streetmap-bengaluru",
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

export default connectDB;
