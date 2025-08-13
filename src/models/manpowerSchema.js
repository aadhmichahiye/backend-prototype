import mongoose from "mongoose";

const manpowerSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
    },
    count: {
      type: Number,
      required: true,
    },
    availableFrom: Date,
    availableTill: Date,
    contractorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false, // Disable __
  }
);

const Manpower = mongoose.model("Manpower", manpowerSchema);
export default Manpower;
