import mongoose from "mongoose";
import ClientJobPost from "../models/clientJobPostSchema.js";
import RequiredWorker from "../models/clientRequiredWorkersSchema.js";
import { parseDateFromDDMMYYYY } from "../utils/dateParser.js";

export const createJobPost = async (req, res) => {
  try {
    console.log("Create jobPost body:", req.body);

    // Ensure authenticated user is present
    const clientId = req.user?.id;
    if (!clientId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: user not found in token" });
    }

    const {
      title,
      description,
      city,
      location,
      startDate,
      endDate,
      requiredWorkers,
      pinCode,
    } = req.body ?? {};

    // Basic validations
    if (!title) return res.status(400).json({ message: "Title is required" });
    if (!city) return res.status(400).json({ message: "City is required" });
    if (!location)
      return res.status(400).json({ message: "Location is required" });
    if (!pinCode)
      return res.status(400).json({ message: "Pin code is required" });

    if (!Array.isArray(requiredWorkers) || requiredWorkers.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one required worker is required" });
    }

    // Validate workers
    for (const [i, w] of requiredWorkers.entries()) {
      if (!w || typeof w !== "object") {
        return res
          .status(400)
          .json({ message: `requiredWorkers[${i}] must be an object` });
      }
      if (!w.type)
        return res
          .status(400)
          .json({ message: `requiredWorkers[${i}].type is required` });
      if (w.count === undefined || w.count === null || w.count === "") {
        return res
          .status(400)
          .json({ message: `requiredWorkers[${i}].count is required` });
      }
      const cnt = Number(w.count);
      if (!Number.isFinite(cnt) || cnt <= 0) {
        return res.status(400).json({
          message: `requiredWorkers[${i}].count must be a positive number`,
        });
      }
      w.count = Math.floor(cnt);
    }

    // Optional date parsing
    let parsedStartDate = undefined;
    let parsedEndDate = undefined;

    if (startDate) {
      parsedStartDate = parseDateFromDDMMYYYY(startDate);
      if (!parsedStartDate) {
        return res
          .status(400)
          .json({ message: "Invalid start date format. Use DD/MM/YYYY" });
      }
    }

    if (endDate) {
      parsedEndDate = parseDateFromDDMMYYYY(endDate);
      if (!parsedEndDate) {
        return res
          .status(400)
          .json({ message: "Invalid end date format. Use DD/MM/YYYY" });
      }
      if (parsedStartDate && parsedEndDate < parsedStartDate) {
        return res
          .status(400)
          .json({ message: "End date must be the same or after start date" });
      }
    }

    // --- IMPORTANT: use `details` because your schema requires it ---
    const jobPost = await ClientJobPost.create({
      details: clientId, // <-- match schema required field
      title,
      description,
      city,
      location,
      pinCode,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      status: "open",
      contactDetails: {
        phone: req.user?.phone,
      },
    });

    // Create RequiredWorker docs referencing this job post
    const createdWorkers = await RequiredWorker.insertMany(
      requiredWorkers.map((worker) => ({
        type: worker.type,
        count: worker.count,
        jobDetails: jobPost._id,
        status: "open",
        clientId, // optional, helpful for queries
      }))
    );

    jobPost.requiredWorkers = createdWorkers.map((w) => w._id);
    await jobPost.save();

    return res.status(201).json({ message: "Job post created", jobPost });
  } catch (err) {
    console.error("❌ Error creating job post with workers:", err);
    return res.status(500).json({
      message: "Error creating job post with workers",
      error: err.message,
    });
  }
};

export const getClientJobPosts = async (req, res) => {
  try {
    const clientId = req.user?.id;
    if (!clientId) return res.status(401).json({ message: "Unauthorized" });

    // Pagination + optional filters
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(
      1,
      Math.min(100, parseInt(req.query.limit || "20", 10))
    );
    const skip = (page - 1) * limit;

    const filters = {};
    // allow filtering by status and city
    if (req.query.status) filters.status = req.query.status;
    if (req.query.city) filters.city = req.query.city;

    // Support both schema variants where client reference might be `clientId` or `details`
    const ownerQuery = {
      $or: [{ clientId }, { details: clientId }],
    };

    const finalQuery = { ...ownerQuery, ...filters };

    // count total
    const total = await ClientJobPost.countDocuments(finalQuery);

    // find posts, populate requiredWorkers
    const posts = await ClientJobPost.find(finalQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "requiredWorkers",
        select: "type count status jobDetails createdAt updatedAt",
        // if requiredWorker has jobDetails you don't need to populate that here
      })
      .lean();

    return res.status(200).json({
      message: "Client job posts fetched",
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
      data: posts,
    });
  } catch (err) {
    console.error("❌ Error fetching client job posts:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};
