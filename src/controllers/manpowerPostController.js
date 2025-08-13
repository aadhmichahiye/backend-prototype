import AvailableWorker from "../models/availableWorkersSchema.js";
import ManpowerPost from "../models/manpowerPostSchema.js";

export const createManpower = async (req, res) => {
  try {
    const contractorId = req.user.id; // Securely from JWT middleware
    const {
      city,
      location,
      availableWorkers, // Array of { type, count }
    } = req.body;

    // Basic validations
    if (
      !city ||
      !location ||
      !Array.isArray(availableWorkers) ||
      availableWorkers.length === 0
    ) {
      return res
        .status(400)
        .json({ message: "All fields are required including workers" });
    }

    const manpowerPost = await ManpowerPost.create({
      contractorId,
      city,
      location,
      status: "open",
    });

    const createdWorkers = await AvailableWorker.insertMany(
      availableWorkers.map((worker) => ({
        type: worker.type,
        count: worker.count,
        manpowerPostId: manpowerPost._id,
        status: "available",
      }))
    );

    const workerIds = createdWorkers.map((worker) => worker._id);

    manpowerPost.availableWorkers = workerIds;

    await manpowerPost.save();

    res.status(201).json({
      message: "Manpower post created successfully",
      data: manpowerPost,
    });
  } catch (error) {
    console.error("❌ Error posting manpower:", error.message);
    res.status(500).json({ message: "Server error while posting manpower" });
  }
};

