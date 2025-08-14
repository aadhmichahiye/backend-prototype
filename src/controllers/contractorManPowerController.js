import AvailableWorker from "../models/contractorAvailableWorkersSchema.js";
import ManpowerPost from "../models/contractorManPowerAvailableSchema.js";
import User from "../models/userSchema.js";

export const createManpower = async (req, res) => {
  try {
    const contractorId = req.user.id; // Securely from JWT middleware
    const user = await User.findById(contractorId);
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
      details: contractorId,
      city,
      location,
      status: "open",
      contactDetails: {
        phone: req.user.phone,
      },
      name: user.name,
    });

    const createdWorkers = await AvailableWorker.insertMany(
      availableWorkers.map((worker) => ({
        type: worker.type,
        count: worker.count,
        jobDetails: manpowerPost._id,
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
