import mongoose from "mongoose";
import ClientJobPost from "../models/clientJobPostSchema.js";
import RequiredWorker from "../models/clientRequiredWorkersSchema.js";
import { parseDateFromDDMMYYYY } from "../utils/dateParser.js";

export const createJobPost = async (req, res) => {
  try {
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
export const getClientMyJobPosts = async (req, res) => {
  try {
    const clientId = req.user?.id;
    if (!clientId) return res.status(401).json({ message: "Unauthorized" });

    // Pagination
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(
      1,
      Math.min(100, parseInt(req.query.limit || "20", 10))
    );
    const skip = (page - 1) * limit;

    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.city) filters.city = req.query.city;

    // 🔍 Search filter (title, city, location, pinCode, contactDetails.phone)
    if (req.query.search) {
      const regex = new RegExp(req.query.search, "i"); // case-insensitive
      filters.$or = [
        { title: regex },
        { city: regex },
        { location: regex },
        { pinCode: regex },
        { "contactDetails.phone": regex },
      ];
    }

    // Ensure jobs belong to the authenticated client
    const ownerQuery = {
      $or: [{ clientId }, { details: clientId }],
    };

    const finalQuery = { ...ownerQuery, ...filters };

    // Count total
    const total = await ClientJobPost.countDocuments(finalQuery);

    // Fetch posts
    const posts = await ClientJobPost.find(finalQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "requiredWorkers",
        select: "type count status jobDetails createdAt updatedAt",
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

export const getJobPostById = async (req, res) => {
  try {
    const jobId = req.params.id;

    if (!jobId) {
      return res.status(400).json({ message: "Job ID is required" });
    }

    const jobPost = await ClientJobPost.findById(jobId)
      .populate({
        path: "requiredWorkers",
        select: "type count status jobDetails createdAt updatedAt",
      })
      .lean();

    if (!jobPost) {
      return res.status(404).json({ message: "Job post not found" });
    }

    return res.status(200).json({
      message: "Job post details fetched successfully",
      data: jobPost,
    });
  } catch (err) {
    console.error("❌ Error fetching job post by ID:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

export const updateJobPostById = async (req, res) => {
  const jobId = req.params.id;
  const clientId = req.user?.id;

  console.log("Update jobPost body:", req.body);

  if (!clientId) return res.status(401).json({ message: "Unauthorized" });
  if (!jobId) return res.status(400).json({ message: "Job id is required" });

  const {
    title,
    description,
    city,
    location,
    startDate,
    endDate,
    requiredWorkers,
    pinCode,
    status,
  } = req.body ?? {};

  // Basic validations (only when fields are present)
  if (title !== undefined && !title)
    return res.status(400).json({ message: "Title cannot be empty" });
  if (city !== undefined && !city)
    return res.status(400).json({ message: "City cannot be empty" });
  if (location !== undefined && !location)
    return res.status(400).json({ message: "Location cannot be empty" });
  if (pinCode !== undefined && !pinCode)
    return res.status(400).json({ message: "Pin code cannot be empty" });

  // Validate workers array if provided
  if (requiredWorkers !== undefined) {
    if (!Array.isArray(requiredWorkers) || requiredWorkers.length === 0) {
      return res.status(400).json({
        message: "requiredWorkers must be a non-empty array when provided",
      });
    }
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
  }

  // Parse optional dates
  let parsedStartDate, parsedEndDate;
  if (startDate) {
    parsedStartDate = parseDateFromDDMMYYYY(startDate);
    if (!parsedStartDate)
      return res
        .status(400)
        .json({ message: "Invalid start date format. Use DD/MM/YYYY" });
  }
  if (endDate) {
    parsedEndDate = parseDateFromDDMMYYYY(endDate);
    if (!parsedEndDate)
      return res
        .status(400)
        .json({ message: "Invalid end date format. Use DD/MM/YYYY" });
    if (parsedStartDate && parsedEndDate < parsedStartDate) {
      return res
        .status(400)
        .json({ message: "End date must be the same or after start date" });
    }
  }

  try {
    // find job post
    const jobPost = await ClientJobPost.findById(jobId);
    if (!jobPost)
      return res.status(404).json({ message: "Job post not found" });

    // check ownership (jobPost.details stores owner)
    const ownerId = jobPost.details?.toString() || jobPost.clientId?.toString();
    if (ownerId !== clientId) {
      return res
        .status(403)
        .json({ message: "Forbidden: you can only update your own job posts" });
    }

    // Prepare update object (only include provided fields)
    const update = {};
    if (title !== undefined) update.title = title;
    if (description !== undefined) update.description = description;
    if (city !== undefined) update.city = city;
    if (location !== undefined) update.location = location;
    if (pinCode !== undefined) update.pinCode = pinCode;
    if (status !== undefined) update.status = status;
    if (parsedStartDate !== undefined) update.startDate = parsedStartDate;
    if (parsedEndDate !== undefined) update.endDate = parsedEndDate;

    // Apply the updates to jobPost
    Object.assign(jobPost, update);

    // If requiredWorkers provided — replace existing ones atomically-ish
    if (requiredWorkers !== undefined) {
      // Optionally use a mongoose session/transaction if your MongoDB is a replica set
      // For now do sequential: delete old workers, insert new ones, update jobPost.requiredWorkers
      await RequiredWorker.deleteMany({ jobDetails: jobPost._id });

      const createdWorkers = await RequiredWorker.insertMany(
        requiredWorkers.map((worker) => ({
          type: worker.type,
          count: worker.count,
          jobDetails: jobPost._id,
          status: "open",
          clientId,
        }))
      );
      jobPost.requiredWorkers = createdWorkers.map((w) => w._id);
    }

    // update contactDetails.phone from token if you want to keep it current
    if (!jobPost.contactDetails) jobPost.contactDetails = {};
    jobPost.contactDetails.phone =
      req.user?.phone ?? jobPost.contactDetails.phone;

    await jobPost.save();

    // populate requiredWorkers to return a nice response
    const populated = await ClientJobPost.findById(jobPost._id).populate({
      path: "requiredWorkers",
      select: "type count status jobDetails createdAt updatedAt",
    });

    return res
      .status(200)
      .json({ message: "Job post updated", data: populated });
  } catch (err) {
    console.error("❌ Error updating job post:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};


export const deleteClientJobPostById = async (req, res) => {
  try {
    const jobId = req.params.id;
    const clientId = req.user?.id;

    if (!clientId) return res.status(401).json({ message: "Unauthorized" });
    if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid job id" });
    }

    const jobPost = await ClientJobPost.findById(jobId);
    if (!jobPost) return res.status(404).json({ message: "Job post not found" });

    // Ensure the requester owns this post
    const ownerId = jobPost.details?.toString() || jobPost.clientId?.toString();
    if (ownerId !== clientId) {
      return res.status(403).json({ message: "Forbidden: you can only delete your own job posts" });
    }

    // Delete associated required workers
    await RequiredWorker.deleteMany({ jobDetails: jobPost._id });

    // Delete the job post itself
    await ClientJobPost.deleteOne({ _id: jobPost._id });

    // Return 204 No Content (successful delete, nothing to return)
    return res.status(204).send();
  } catch (err) {
    console.error("❌ Error deleting job post:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};



export const getAllClientJobPostsForContractors = async (req, res) => {
  try {
    // Ensure requester is authenticated
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // pagination & params
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit || "20", 10)));
    const skip = (page - 1) * limit;

    const {
      search,
      city,
      status,
      workerType, // optional filter on required worker type
      minCount, // optional filter: required worker count >= minCount
      sortBy = "createdAt",
      sortDir = "desc",
    } = req.query;

    // Build initial match for post-level fields
    const match = {};

    if (city) {
      match.city = { $regex: String(city).trim(), $options: "i" };
    }

    if (status) {
      match.status = String(status).trim();
    }

    if (search) {
      const q = String(search).trim();
      const regex = { $regex: q, $options: "i" };
      match.$or = [
        { title: regex },
        { description: regex },
        { city: regex },
        { location: regex },
        { pinCode: regex },
        { "contactDetails.phone": regex },
      ];
    }

    const pipeline = [];

    // 1) match post-level filters
    if (Object.keys(match).length) pipeline.push({ $match: match });

    // 2) lookup required worker docs (assumes requiredWorkers is array of ObjectId refs)
    pipeline.push({
      $lookup: {
        from: RequiredWorker.collection.name,
        localField: "requiredWorkers",
        foreignField: "_id",
        as: "requiredWorkers",
      },
    });

    // 3) if workerType or minCount present, filter posts which have at least one requiredWorker matching
    if (workerType || minCount) {
      const elemMatch = {};
      if (workerType) elemMatch.type = { $regex: String(workerType).trim(), $options: "i" };
      if (minCount) elemMatch.count = { $gte: Number(minCount) };
      pipeline.push({ $match: { requiredWorkers: { $elemMatch: elemMatch } } });
    }

    // 4) project only required fields (we keep requiredWorkers as list of objects)
    pipeline.push({
      $project: {
        details: 1,           // client id
        _id: 1,
        title: 1,
        description: 1,
        city: 1,
        location: 1,
        pinCode: 1,
        status: 1,
        contactDetails: 1,
        createdAt: 1,
        updatedAt: 1,
        requiredWorkers: {
          $map: {
            input: "$requiredWorkers",
            as: "w",
            in: {
              _id: "$$w._id",
              type: "$$w.type",
              count: "$$w.count",
              status: "$$w.status",
            },
          },
        },
      },
    });

    // 5) sort then facet for pagination + total in one roundtrip
    const sortOrder = sortDir.toLowerCase() === "asc" ? 1 : -1;
    const sortObj = { [sortBy]: sortOrder, _id: 1 };

    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $sort: sortObj }, { $skip: skip }, { $limit: limit }],
      },
    });

    // Run aggregation
    const agg = await ClientJobPost.aggregate(pipeline).allowDiskUse(true);

    const metaDoc = (agg[0] && agg[0].metadata && agg[0].metadata[0]) || { total: 0 };
    const total = metaDoc.total || 0;
    const data = (agg[0] && agg[0].data) || [];

    const pages = Math.max(1, Math.ceil(total / limit || 1));

    return res.status(200).json({
      message: "Client job posts fetched",
      meta: { total, page, limit, pages },
      data,
    });
  } catch (err) {
    console.error("❌ Error fetching client job posts for contractors:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};