import mongoose from "mongoose";

const jobPostSchema = new mongoose.Schema(
  {
    details: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
    },
    city: {
      type: String,
      required: true,
      enum: ["Hyderabad", "Bangalore", "Chennai", "Delhi", "Mumbai"],
    },
    location: {
      type: String,
      required: true,
    },
    requiredWorkers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RequiredWorker",
      },
    ],
    status: {
      type: String,
      enum: ["open", "closed", "paused"],
      default: "open",
    },
    contactDetails: {
      phone: { type: String },
    },
    startDate: Date,
    endDate: Date,
  },
  { timestamps: true }
);

const JobPost = mongoose.model("ClientJobPost", jobPostSchema);
export default JobPost;
