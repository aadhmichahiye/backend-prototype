import mongoose from "mongoose";
import AvailableWorker from "../models/contractorAvailableWorkersSchema.js";
import ManpowerPost from "../models/contractorManPowerAvailableSchema.js";
import User from "../models/userSchema.js";

// controllers/contractorController.js (or wherever createManpower lives)

/**
 * Create manpower post — accepts payload shape similar to the example:
 * {
 *  name, city, location, pincode (or pinCode), phone (optional),
 *  status (optional), workers: [{type, count}, ...] OR availableWorkers
 * }
 */
export const createManpower = async (req, res) => {
  try {
    const contractorId = req.user?.id;
    if (!contractorId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(contractorId).select("_id name phone");
    if (!user) return res.status(404).json({ message: "Contractor not found" });

    // accept both names
    const {
      title,
      description,
      city,
      location,
      pinCode,
      availableWorkers,
      name,
      phone,
      status,
    } = req.body ?? {};

    const finalPin = (pinCode || "").toString().trim();

    // Basic validations
    if (!city || !location) {
      return res
        .status(400)
        .json({ message: "city and location are required" });
    }

    const workersArr = Array.isArray(availableWorkers)
      ? availableWorkers
      : Array.isArray(workers)
      ? workers
      : null;

    if (!Array.isArray(workersArr) || workersArr.length === 0) {
      return res
        .status(400)
        .json({ message: "workers must be a non-empty array" });
    }

    // Validate each worker item
    for (const [i, w] of workersArr.entries()) {
      if (!w || typeof w !== "object") {
        return res
          .status(400)
          .json({ message: `workers[${i}] must be an object` });
      }
      if (!w.type) {
        return res
          .status(400)
          .json({ message: `workers[${i}].type is required` });
      }
      if (w.count === undefined || w.count === null || w.count === "") {
        return res
          .status(400)
          .json({ message: `workers[${i}].count is required` });
      }
      const cnt = Number(w.count);
      if (!Number.isFinite(cnt) || cnt <= 0) {
        return res.status(400).json({
          message: `workers[${i}].count must be a positive number`,
        });
      }
      // normalize count to integer
      w.count = Math.floor(cnt);
    }

    if (!finalPin) {
      return res.status(400).json({ message: "pincode (pinCode) is required" });
    }

    // phone handling: prefer authenticated user's phone, allow override by body if valid
    const phoneCandidate = (user.phone && String(user.phone).trim()) || null;
    const bodyPhoneStr = phone ? String(phone).trim() : null;

    // simple phone normalization: if bodyPhone provided and looks numeric (10-15 digits), accept it
    let contactPhone = phoneCandidate;
    if (bodyPhoneStr) {
      const digits = bodyPhoneStr.replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 15) {
        // try to keep E.164-ish: add + if not present and likely local (optional)
        contactPhone = bodyPhoneStr.startsWith("+")
          ? bodyPhoneStr
          : `+${digits}`;
      } else {
        return res
          .status(400)
          .json({ message: "Invalid phone format in body" });
      }
    }

    // Create manpower post
    const manpowerPost = await ManpowerPost.create({
      details: contractorId,
      title: title || `${name || user.name} - Manpower Post`,
      description: description || "",
      city,
      location,
      pinCode: finalPin,
      status: status || "open",
      name: name || user.name,
      contactDetails: { phone: contactPhone },
    });

    // Create available worker documents and link them
    const createdWorkers = await AvailableWorker.insertMany(
      workersArr.map((worker) => ({
        type: worker.type,
        count: worker.count,
        jobDetails: manpowerPost._id,
        status: worker.status || "available",
        contractorId: contractorId,
      }))
    );

    // attach worker ids to manpowerPost
    manpowerPost.availableWorkers = createdWorkers.map((w) => w._id);
    await manpowerPost.save();

    // populate availableWorkers for response
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
    const limit = Math.max(
      1,
      Math.min(200, parseInt(req.query.limit || "20", 10))
    );
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
      if (workerType)
        elemMatch.type = { $regex: String(workerType).trim(), $options: "i" };
      if (minCount) elemMatch.count = { $gte: Number(minCount) };
      pipeline.push({
        $match: { availableWorkers: { $elemMatch: elemMatch } },
      });
    }

    // 4) project only required fields (we keep availableWorkers as list of objects)
    pipeline.push({
      $project: {
        details: 1, // contractor id
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

    const metaDoc = (agg[0] && agg[0].metadata && agg[0].metadata[0]) || {
      total: 0,
    };
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
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

export const getManpowerPostById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id)
      return res.status(400).json({ message: "Manpower post id is required" });

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid manpower post id" });
    }

    // aggregation: match the single post, lookup availableWorkers, project fields
    const pipeline = [
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: AvailableWorker.collection.name,
          localField: "availableWorkers",
          foreignField: "_id",
          as: "availableWorkers",
        },
      },
      {
        $project: {
          details: 1,
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
      },
      { $limit: 1 },
    ];

    const agg = await ManpowerPost.aggregate(pipeline).allowDiskUse(true);
    const post = (agg && agg[0]) || null;

    if (!post) {
      return res.status(404).json({ message: "Manpower post not found" });
    }

    return res.status(200).json({
      message: "Manpower post fetched",
      data: post,
    });
  } catch (err) {
    console.error("❌ Error fetching manpower post by id:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

export const getManpowerPostsByContractor = async (req, res) => {
  try {
    const contractorId = req.user?.id;
    if (!contractorId) return res.status(401).json({ message: "Unauthorized" });

    if (!mongoose.Types.ObjectId.isValid(contractorId)) {
      return res
        .status(400)
        .json({ message: "Invalid contractor id in token" });
    }

    // pagination & params
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(
      1,
      Math.min(200, parseInt(req.query.limit || "20", 10))
    );
    const skip = (page - 1) * limit;

    const {
      search,
      city,
      status,
      workerType, // optional: only posts with at least one worker of this type
      minCount, // optional: only posts with at least one worker count >= minCount
      sortBy = "createdAt",
      sortDir = "desc",
    } = req.query;

    // Build initial match for post-level fields
    const match = { details: new mongoose.Types.ObjectId(contractorId) };

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
        from: AvailableWorker.collection.name,
        localField: "availableWorkers",
        foreignField: "_id",
        as: "availableWorkers",
      },
    });

    // 3) filter by workerType/minCount if requested (post must have at least one matching worker)
    if (workerType || minCount) {
      const elemMatch = {};
      if (workerType)
        elemMatch.type = { $regex: String(workerType).trim(), $options: "i" };
      if (minCount) elemMatch.count = { $gte: Number(minCount) };
      pipeline.push({
        $match: { availableWorkers: { $elemMatch: elemMatch } },
      });
    }

    // 4) project only required fields (keep availableWorkers as list of objects)
    pipeline.push({
      $project: {
        details: 1, // contractor id
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

    const metaDoc = (agg[0] && agg[0].metadata && agg[0].metadata[0]) || {
      total: 0,
    };
    const total = metaDoc.total || 0;
    const data = (agg[0] && agg[0].data) || [];

    const pages = Math.max(1, Math.ceil(total / limit || 1));

    return res.status(200).json({
      message: "Contractor's manpower posts fetched",
      meta: { total, page, limit, pages },
      data,
    });
  } catch (err) {
    console.error("❌ Error fetching contractor's manpower posts:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

export const deleteManpowerPost = async (req, res) => {
  const contractorId = req.user?.id;
  const { id: postId } = req.params;

  try {
    if (!contractorId) return res.status(401).json({ message: "Unauthorized" });

    if (!postId)
      return res.status(400).json({ message: "post id is required" });

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: "Invalid post id" });
    }

    // fetch the post and ensure ownership
    const post = await ManpowerPost.findById(postId).select(
      "details availableWorkers"
    );
    if (!post)
      return res.status(404).json({ message: "Manpower post not found" });

    // ownership check: post.details should equal contractorId
    if (String(post.details) !== String(contractorId)) {
      return res
        .status(403)
        .json({ message: "Forbidden: you cannot delete this post" });
    }

    // Try using a transaction if possible (requires replica set)
    const session = await mongoose.startSession();
    let usedTransaction = false;
    try {
      session.startTransaction();
      usedTransaction = true;

      // Delete available workers referencing this post
      await AvailableWorker.deleteMany({ jobDetails: post._id }, { session });

      // Delete the manpower post
      await ManpowerPost.deleteOne({ _id: post._id }, { session });

      await session.commitTransaction();
      session.endSession();
    } catch (txErr) {
      // Transaction failed (maybe not supported). Abort and fallback to sequential deletes.
      if (usedTransaction) {
        try {
          await session.abortTransaction();
        } catch (e) {
          // ignore
        }
        session.endSession();
      }
      console.warn(
        "Transaction failed or not supported, falling back to sequential deletes:",
        txErr.message
      );

      // Sequential delete fallback
      await AvailableWorker.deleteMany({ jobDetails: post._id });
      await ManpowerPost.deleteOne({ _id: post._id });
    }

    return res
      .status(200)
      .json({ message: "Manpower post deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting manpower post:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

export const updateManpowerPostById = async (req, res) => {
  const contractorId = req.user?.id;
  const { id: postId } = req.params;

  try {
    if (!contractorId) return res.status(401).json({ message: "Unauthorized" });
    if (!postId)
      return res.status(400).json({ message: "post id is required" });
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: "Invalid post id" });
    }

    // fetch post to check ownership and current workers
    const post = await ManpowerPost.findById(postId).select(
      "details availableWorkers"
    );
    if (!post)
      return res.status(404).json({ message: "Manpower post not found" });
    if (String(post.details) !== String(contractorId)) {
      return res
        .status(403)
        .json({ message: "Forbidden: you cannot modify this post" });
    }

    const body = req.body ?? {};

    const updateFields = {};
    if (body.title !== undefined)
      updateFields.title = String(body.title).trim();
    if (body.description !== undefined)
      updateFields.description = String(body.description).trim();
    if (body.city !== undefined) updateFields.city = String(body.city).trim();
    if (body.location !== undefined)
      updateFields.location = String(body.location).trim();

    const pin = body.pinCode ?? body.pincode;
    if (pin !== undefined) updateFields.pinCode = String(pin).trim();

    if (body.status !== undefined)
      updateFields.status = String(body.status).trim();
    if (body.name !== undefined) updateFields.name = String(body.name).trim();

    if (body.contactDetails && body.contactDetails.phone !== undefined) {
      updateFields["contactDetails.phone"] = String(
        body.contactDetails.phone
      ).trim();
    } else if (body.phone !== undefined) {
      updateFields["contactDetails.phone"] = String(body.phone).trim();
    }

    const parseDate = (d) => {
      if (!d) return null;
      if (typeof d !== "string") return null;
      const iso = new Date(d);
      if (!isNaN(iso.getTime()) && d.includes("-")) return iso;
      const parts = d.split("/").map((p) => parseInt(p, 10));
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        const dt = new Date(yyyy, mm - 1, dd);
        if (!isNaN(dt.getTime())) return dt;
      }
      return null;
    };

    if (body.startDate !== undefined) {
      const d = parseDate(body.startDate);
      if (body.startDate && !d) {
        return res
          .status(400)
          .json({ message: "Invalid startDate format. Use DD/MM/YYYY or ISO" });
      }
      updateFields.startDate = d || undefined;
    }

    if (body.endDate !== undefined) {
      const d = parseDate(body.endDate);
      if (body.endDate && !d) {
        return res
          .status(400)
          .json({ message: "Invalid endDate format. Use DD/MM/YYYY or ISO" });
      }
      updateFields.endDate = d || undefined;
    }

    // incoming workers array (supports 'workers' or 'availableWorkers')
    const incomingWorkers = Array.isArray(body.availableWorkers)
      ? body.availableWorkers
      : Array.isArray(body.workers)
      ? body.workers
      : null;

    // Start transaction/session
    const session = await mongoose.startSession();
    let usedTransaction = false;

    try {
      session.startTransaction();
      usedTransaction = true;

      if (incomingWorkers) {
        // Normalize incoming items
        const normalized = incomingWorkers.map((w, idx) => {
          if (!w || typeof w !== "object")
            throw new Error(`workers[${idx}] must be an object`);
          const item = {};
          if (w._id) {
            if (!mongoose.Types.ObjectId.isValid(String(w._id))) {
              throw new Error(`workers[${idx}].id is invalid`);
            }
            // IMPORTANT: use 'new' when constructing
            item._id = new mongoose.Types.ObjectId(String(w._id));
          }
          if (w.type !== undefined) item.type = String(w.type).trim();
          if (w.count !== undefined) {
            const cnt = Number(w.count);
            if (!Number.isFinite(cnt) || cnt <= 0)
              throw new Error(
                `workers[${idx}].count must be a positive number`
              );
            item.count = Math.floor(cnt);
          }
          if (w.status !== undefined) item.status = String(w.status).trim();
          return item;
        });

        // existing worker ids attached to this post
        const existingWorkerIds = (post.availableWorkers || []).map((id) =>
          String(id)
        );

        // incoming ids
        const incomingIds = normalized
          .filter((iw) => iw._id)
          .map((iw) => String(iw._id));

        // toDelete: existing not present in incoming
        const toDeleteIds = existingWorkerIds.filter(
          (eid) => !incomingIds.includes(eid)
        );

        // updates & inserts
        const toUpdate = normalized.filter((iw) => iw._id);
        const toInsert = normalized.filter((iw) => !iw._id);

        // delete removed workers
        if (toDeleteIds.length > 0) {
          const objectIdsToDelete = toDeleteIds.map(
            (s) => new mongoose.Types.ObjectId(s)
          );
          await AvailableWorker.deleteMany(
            { _id: { $in: objectIdsToDelete }, jobDetails: post._id },
            { session }
          );
        }

        // update existing workers
        for (const iw of toUpdate) {
          const updateObj = {};
          if (iw.type !== undefined) updateObj.type = iw.type;
          if (iw.count !== undefined) updateObj.count = iw.count;
          if (iw.status !== undefined) updateObj.status = iw.status;
          if (Object.keys(updateObj).length > 0) {
            await AvailableWorker.updateOne(
              { _id: iw._id, jobDetails: post._id },
              { $set: updateObj },
              { session }
            );
          }
        }

        // insert new workers
        let insertedIds = [];
        if (toInsert.length > 0) {
          const docs = toInsert.map((iw) => ({
            type: iw.type,
            count: iw.count,
            status: iw.status || "available",
            jobDetails: post._id,
            contractorId: new mongoose.Types.ObjectId(contractorId),
          }));
          const inserted = await AvailableWorker.insertMany(docs, { session });
          insertedIds = inserted.map((d) => d._id);
        }

        // refresh final worker ids and set on post
        const finalWorkerDocs = await AvailableWorker.find(
          { jobDetails: post._id },
          null,
          { session }
        ).select("_id");
        updateFields.availableWorkers = finalWorkerDocs.map((d) => d._id);
      }

      // Apply post-level updates
      if (Object.keys(updateFields).length > 0) {
        const setObj = {};
        const unsetObj = {};
        for (const [k, v] of Object.entries(updateFields)) {
          if (v === undefined) unsetObj[k] = "";
          else setObj[k] = v;
        }

        const updateOps = {};
        if (Object.keys(setObj).length > 0) updateOps.$set = setObj;
        if (Object.keys(unsetObj).length > 0) updateOps.$unset = unsetObj;

        if (Object.keys(updateOps).length > 0) {
          await ManpowerPost.updateOne({ _id: post._id }, updateOps, {
            session,
          });
        }
      }

      // commit
      await session.commitTransaction();
      session.endSession();
    } catch (txErr) {
      if (usedTransaction) {
        try {
          await session.abortTransaction();
        } catch (e) {
          // ignore
        }
        session.endSession();
      }
      // bubble up the error
      throw txErr;
    }

    // Return updated populated post
    const updated = await ManpowerPost.findById(post._id)
      .populate({
        path: "availableWorkers",
        select: "type count status jobDetails createdAt updatedAt",
      })
      .lean();

    return res.status(200).json({
      message: "Manpower post updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("❌ Error updating manpower post:", err);
    const msg = err?.message || "Server error";
    return res
      .status(500)
      .json({ message: "Failed to update manpower post", error: msg });
  }
};


