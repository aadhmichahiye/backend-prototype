import express from "express";

import { verifyAccessToken } from "../middleware/auth.js";
import { authorizeClient } from "../middleware/authorizeClient.js";
import {
  createJobPost,
  getClientJobPosts,
} from "../controllers/clientJobPostController.js";

const router = express.Router();

router.post("/create", verifyAccessToken, authorizeClient, createJobPost);
router.get("/my-posts", verifyAccessToken, authorizeClient, getClientJobPosts);

export default router;
