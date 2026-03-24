import mongoose from "mongoose";

const ReviewVoteEntrySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    direction: { type: String, enum: ["up", "down"], required: true },
  },
  { _id: false }
);

const ReviewSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    author: {
      type: String,
      trim: true,
      default: "",
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    upvotes: {
      type: Number,
      default: 0,
      min: 0,
    },
    downvotes: {
      type: Number,
      default: 0,
      min: 0,
    },
    reviewVotes: {
      type: [ReviewVoteEntrySchema],
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const PlaceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  category: {
    type: String,
    enum: ["cafe", "food", "malls", "park", "metro", "bmtc", "restaurant", "place"],
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

  menuImages: [
    {
      type: String
    }
  ],

  photos: [
    {
      type: String
    }
  ],

  reviews: [ReviewSchema],

  creatorReview: {
    type: ReviewSchema,
    default: null,
  },

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
  },
  osmId: { type: String, default: null },
});

PlaceSchema.index({ name: "text", description: "text", tags: "text", "reviews.text": "text", "creatorReview.text": "text", area: "text" });
PlaceSchema.index({ location: "2dsphere" });

if (process.env.NODE_ENV !== "production" && mongoose.models.Place) {
  mongoose.deleteModel("Place");
}

export default mongoose.models.Place || mongoose.model("Place", PlaceSchema);
