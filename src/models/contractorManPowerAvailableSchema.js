import mongoose from "mongoose";

const manpowerPostSchema = new mongoose.Schema(
  {
    details: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: false,
      trim: true,
    },
    description: {
      type: String,
      required: false,
    },
    city: {
      type: String,
      required: true,
      enum: ["hyderabad", "bangalore", "chennai", "delhi", "mumbai"],
    },
    location: {
      type: String,
      required: true,
    },
    availableWorkers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AvailableWorker",
      },
    ],
    status: {
      type: String,
      enum: ["open", "closed", "paused"],
      default: "open",
    },
    name: {
      type: String,
      required: true,
    },
    contactDetails: {
      phone: { type: String },
    },
    startDate: Date,
    endDate: Date,
  },
  { timestamps: true }
);

const ManpowerPost = mongoose.model("ManpowerPost", manpowerPostSchema);
export default ManpowerPost;
