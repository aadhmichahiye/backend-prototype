import express from "express";

import { verifyAccessToken } from "../middleware/auth.js";
import { authorizeClient } from "../middleware/authorizeClient.js";
import {
  createJobPost,
  deleteClientJobPostById,
  getAllClientJobPostsForContractors,
  getClientMyJobPosts,
  getJobPostById,
  updateJobPostById,
} from "../controllers/clientJobPostController.js";
import { authorizeContractor } from "../middleware/authorizeContractor.js";

const router = express.Router();

router.post("/create", verifyAccessToken, authorizeClient, createJobPost);
router.get(
  "/my-posts",
  verifyAccessToken,
  authorizeClient,
  getClientMyJobPosts
);
router.get("/my-posts/:id", verifyAccessToken, authorizeClient, getJobPostById);
router.get(
  "/details/:id",
  verifyAccessToken,
  authorizeContractor,
  getJobPostById
);
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

router.get(
  "/all",
  verifyAccessToken,
  authorizeContractor,
  getAllClientJobPostsForContractors
);
export default router;
