import mongoose from "mongoose";

const AvailableWorkerSchema = new mongoose.Schema({
  manpowerPostId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ManpowerPost",
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
    enum: ["available", "unavailable", "blocked"],
    default: "active",
  },
  count: {
    type: Number,
    required: true,
    min: 1,
  },
});

const AvailableWorker = mongoose.model(
  "AvailableWorker",
  AvailableWorkerSchema
);
export default AvailableWorker;
