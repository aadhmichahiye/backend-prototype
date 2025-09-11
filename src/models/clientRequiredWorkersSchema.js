// src/models/clientRequiredWorkersSchema.js
import mongoose from "mongoose";

const requiredWorkerSchema = new mongoose.Schema(
  {
    jobDetails: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientJobPost", // matches your job-post model name
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "mason",
        "helper",
        "electrician",
        "plumber",
        "carpenter",
        "painter",
        "other",
      ],
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "closed", "paused"], // allowed values
      default: "open", // use a value present in enum
    },
    count: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { timestamps: true }
);

// Register model with name "RequiredWorker" so it matches JobPost schema ref
const RequiredWorker = mongoose.model("RequiredWorker", requiredWorkerSchema);
export default RequiredWorker;
