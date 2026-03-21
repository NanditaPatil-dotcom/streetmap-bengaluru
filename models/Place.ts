import mongoose from "mongoose";

const PlaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  category: {
    type: String,
    enum: ["cafe", "park", "metro", "bmtc", "restaurant"],
    required: true
  },

  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true
    }
  },

  area: {
    type: String
  },

  tags: [
    {
      type: String
    }
  ],

  openTime: {
    type: String // "07:00"
  },

  closeTime: {
    type: String // "23:00"
  },

  rating: {
    type: Number,
    default: 0
  },

  description: {
    type: String
  },

  addedBy: {
    type: String,
    default: "user"
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

PlaceSchema.index({ name: "text", description: "text", tags: "text", area: "text" });
PlaceSchema.index({ location: "2dsphere" });

export default mongoose.models.Place || mongoose.model("Place", PlaceSchema);