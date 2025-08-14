import mongoose from "mongoose";

const requiredWorkerSchema = new mongoose.Schema({
  jobDetails: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ClientJobPost",
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: ["mason", "helper", "electrician", "plumber", "carpenter", "painter"], // You can add more types
  },
  status: {
    type: String,
    required: false,
    enum: ["open", "closed", "paused"],
    default: "active",
  },
  count: {
    type: Number,
    required: true,
    min: 1,
  },
});

const RequiredWorker = mongoose.model(
  "ClientRequiredWorker",
  requiredWorkerSchema
);
export default RequiredWorker;
