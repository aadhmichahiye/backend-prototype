import express from "express";

import { verifyAccessToken } from "../middleware/auth.js";
import { authorizeClient } from "../middleware/authorizeClient.js";
import {
  createJobPost,
  deleteClientJobPostById,
  getClientJobPosts,
  getJobPostById,
  updateJobPostById,
} from "../controllers/clientJobPostController.js";

const router = express.Router();

router.post("/create", verifyAccessToken, authorizeClient, createJobPost);
router.get("/my-posts", verifyAccessToken, authorizeClient, getClientJobPosts);
router.get("/my-posts/:id", verifyAccessToken, authorizeClient, getJobPostById);
router.post(
  "/my-posts/update/:id",
  verifyAccessToken,
  authorizeClient,
  updateJobPostById
);
router.delete(
  "/my-posts/delete/:id",
  verifyAccessToken,
  authorizeClient,
  deleteClientJobPostById
);
export default router;
