import Manpower from "../models/manpowerSchema.js";

export const postManpower = async (req, res) => {
  try {
    const contractorId = req.user._id; // Securely from JWT middleware
    const {
      city,
      location,
      workers, // Array of { type, count }
    } = req.body;

    // Basic validations
    if (
      !city ||
      !location ||
      !Array.isArray(workers) ||
      workers.length === 0
    ) {
      return res
        .status(400)
        .json({ message: "All fields are required including workers" });
    }

    // Validate worker types and counts
    for (const worker of workers) {
      if (!worker.type || !worker.count || isNaN(worker.count)) {
        return res
          .status(400)
          .json({
            message: "Each worker must have a valid type and numeric count",
          });
      }
    }

    const manpower = new Manpower({
      contractorId,
      city,
      location,
      workers,
    });

    await manpower.save();

    res.status(201).json({
      message: "Manpower post created successfully",
      data: manpower,
    });
  } catch (error) {
    console.error("❌ Error posting manpower:", error.message);
    res.status(500).json({ message: "Server error while posting manpower" });
  }
};
