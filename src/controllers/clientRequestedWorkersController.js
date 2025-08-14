import RequiredWorker from "../models/requiredWorkersSchema.js";

export const getAllRequiredWorkers = async (req, res) => {
  try {
    const requiredWorkers = await RequiredWorker.find()
      .populate("jobDetails", "title city location status contactDetails") // optional: job info
      .sort({ createdAt: -1 });
    res.status(200).json(requiredWorkers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
