import AvailableWorker from "../models/contractorAvailableWorkersSchema.js";
import ManpowerPost from "../models/contractorManPowerAvailableSchema.js";
import User from "../models/userSchema.js";

export const createManpower = async (req, res) => {
  try {
    const contractorId = req.user?.id;
    if (!contractorId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(contractorId).select("_id name phone");
    if (!user) return res.status(404).json({ message: "Contractor not found" });

    const {
      title,
      description,
      city,
      location,
      pinCode,
      availableWorkers,
      name,
    } = req.body ?? {};

    // Basic validations
    if (!city || !location) {
      return res
        .status(400)
        .json({ message: "city and location are required" });
    }

    if (!Array.isArray(availableWorkers) || availableWorkers.length === 0) {
      return res
        .status(400)
        .json({ message: "availableWorkers must be a non-empty array" });
    }

    // Validate each worker item
    for (const [i, w] of availableWorkers.entries()) {
      if (!w || typeof w !== "object") {
        return res
          .status(400)
          .json({ message: `availableWorkers[${i}] must be an object` });
      }
      if (!w.type) {
        return res
          .status(400)
          .json({ message: `availableWorkers[${i}].type is required` });
      }
      if (w.count === undefined || w.count === null || w.count === "") {
        return res
          .status(400)
          .json({ message: `availableWorkers[${i}].count is required` });
      }
      const cnt = Number(w.count);
      if (!Number.isFinite(cnt) || cnt <= 0) {
        return res.status(400).json({
          message: `availableWorkers[${i}].count must be a positive number`,
        });
      }
      // normalize count to integer
      w.count = Math.floor(cnt);
    }

    if (!pinCode || pinCode.trim() === "") {
      return res.status(400).json({ message: "pinCode is required" });
    }

    // Create manpower post
    const manpowerPost = await ManpowerPost.create({
      details: contractorId,
      title: title || `${user.name} - Manpower Post`,
      description: description || "",
      city,
      location,
      pinCode: pinCode || "",
      status: "open",
      name: name || user.name,
      contactDetails: { phone: user.phone },
    });

    // Create available worker documents and link them
    const createdWorkers = await AvailableWorker.insertMany(
      availableWorkers.map((worker) => ({
        type: worker.type,
        count: worker.count,
        jobDetails: manpowerPost._id,
        status: "available",
        contractorId: contractorId,
      }))
    );

    // attach worker ids to manpowerPost
    manpowerPost.availableWorkers = createdWorkers.map((w) => w._id);
    await manpowerPost.save();

    // populate availableWorkers for response (optional)
    const populated = await ManpowerPost.findById(manpowerPost._id)
      .populate({
        path: "availableWorkers",
        select: "type count status jobDetails createdAt updatedAt",
      })
      .lean();

    return res.status(201).json({
      message: "Manpower post created successfully",
      data: populated,
    });
  } catch (error) {
    console.error("❌ Error posting manpower:", error);
    return res.status(500).json({
      message: "Server error while posting manpower",
      error: error.message,
    });
  }
};

export const getAllManpowerPosts = async (req, res) => {
  try {
    // pagination & params
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit || "20", 10)));
    const skip = (page - 1) * limit;

    const {
      search,
      city,
      status,
      workerType, // optional filter on worker type
      minCount, // optional filter: worker count >= minCount
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
      // match against title/name/city/location/pinCode/contact phone
      match.$or = [
        { title: regex },
        { name: regex },
        { city: regex },
        { location: regex },
        { pinCode: regex },
        { "contactDetails.phone": regex },
      ];
    }

    const pipeline = [];

    // 1) match post-level filters
    if (Object.keys(match).length) pipeline.push({ $match: match });

    // 2) lookup available worker docs (assumes availableWorkers is array of ObjectId refs)
    pipeline.push({
      $lookup: {
        from: AvailableWorker.collection.name, // proper collection name
        localField: "availableWorkers",
        foreignField: "_id",
        as: "availableWorkers",
      },
    });

    // 3) if workerType or minCount present, filter posts which have at least one worker matching
    if (workerType || minCount) {
      const elemMatch = {};
      if (workerType) elemMatch.type = { $regex: String(workerType).trim(), $options: "i" };
      if (minCount) elemMatch.count = { $gte: Number(minCount) };
      pipeline.push({ $match: { availableWorkers: { $elemMatch: elemMatch } } });
    }

    // 4) project only required fields (we keep availableWorkers as list of objects)
    pipeline.push({
      $project: {
        details: 1,           // contractor id
        _id: 1,
        title: 1,
        name: 1,
        city: 1,
        location: 1,
        pinCode: 1,
        status: 1,
        contactDetails: 1,
        createdAt: 1,
        updatedAt: 1,
        // shape worker objects to the minimal fields expected
        availableWorkers: {
          $map: {
            input: "$availableWorkers",
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
    const agg = await ManpowerPost.aggregate(pipeline).allowDiskUse(true);

    const metaDoc = (agg[0] && agg[0].metadata && agg[0].metadata[0]) || { total: 0 };
    const total = metaDoc.total || 0;
    const data = (agg[0] && agg[0].data) || [];

    const pages = Math.max(1, Math.ceil(total / limit || 1));

    return res.status(200).json({
      message: "Manpower posts fetched",
      meta: { total, page, limit, pages },
      data,
    });
  } catch (err) {
    console.error("❌ Error fetching manpower posts:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

