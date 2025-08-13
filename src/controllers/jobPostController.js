import JobPost from "../models/jobPostSchema.js";
import RequiredWorker from "../models/requiredWorkersSchema.js";
import { parseDateFromDDMMYYYY } from "../utils/dateParser.js";

export const createJobPost = async (req, res) => {
  try {
    const clientId = req.user.id;
    const {
      title,
      description,
      city,
      location,
      startDate,
      endDate,
      requiredWorkers,
    } = req.body;
    if (
      !title ||
      !city ||
      !location ||
      !requiredWorkers ||
      requiredWorkers.length === 0
    ) {
      return res
        .status(400)
        .json({ message: "Missing required job post fields" });
    }

    const parsedStartDate = parseDateFromDDMMYYYY(startDate);
    const parsedEndDate = parseDateFromDDMMYYYY(endDate);

    if (isNaN(parsedStartDate.getTime())) {
      return res
        .status(400)
        .json({ message: "Invalid start date format. Use DD/MM/YYYY" });
    }

    if (isNaN(parsedEndDate.getTime())) {
      return res
        .status(400)
        .json({ message: "Invalid end date format. Use DD/MM/YYYY" });
    }

    const jobPost = await JobPost.create({
      clientId,
      title,
      description,
      city,
      location,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      status: "open",
    });

    const createdWorkers = await RequiredWorker.insertMany(
      requiredWorkers.map((worker) => ({
        type: worker.type,
        count: worker.count,
        jobPostId: jobPost._id,
        status: "open",
      }))
    );

    const workerIds = createdWorkers.map((worker) => worker._id);

    jobPost.requiredWorkers = workerIds;

    await jobPost.save();

    return res.status(201).json({ message: "Job post created", jobPost });
  } catch (err) {
    console.error("❌ Error creating job post with workers:", err.message);
    return res.status(500).json({
      message: "Error creating job post with workers",
      error: err.message,
    });
  }
};
