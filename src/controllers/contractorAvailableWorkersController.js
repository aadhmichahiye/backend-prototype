import AvailableWorker from "../models/contractorAvailableWorkersSchema.js";

export const getAllAvailableWorkers = async (req, res) => {
  try {
    const availableWorkers = await AvailableWorker.find({ status: "available" })
      .populate("jobDetails", "city location status contactDetails name")
      .exec();

    res.status(200).json({
      message: "Available workers fetched successfully",
      data: availableWorkers,
    });
  } catch (error) {
    console.error("❌ Error fetching available workers:", error.message);
    res.status(500).json({ message: "Server error while fetching workers" });
  }
};
