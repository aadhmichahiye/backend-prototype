import express from "express";

import { verifyAccessToken } from "../middleware/auth.js";
import { authorizeContractor } from "../middleware/authorizeContractor.js";
import {
  createManpower,
  deleteManpowerPost,
  getAllManpowerPosts,
  getManpowerPostById,
  getManpowerPostsByContractor,
  updateManpowerPostById,
} from "../controllers/contractorManPowerController.js";
import { authorizeClient } from "../middleware/authorizeClient.js";

const router = express.Router();

router.post("/create", verifyAccessToken, authorizeContractor, createManpower);
router.get("/all", verifyAccessToken, authorizeClient, getAllManpowerPosts);
router.get(
  "/details/:id",
  verifyAccessToken,
  authorizeClient,
  getManpowerPostById
);
router.get(
  "/my-posts/:id",
  verifyAccessToken,
  authorizeContractor,
  getManpowerPostById
);
router.get(
  "/my-posts",
  verifyAccessToken,
  authorizeContractor,
  getManpowerPostsByContractor
);

router.delete(
  "/my-posts/delete/:id",
  verifyAccessToken,
  authorizeContractor,
  deleteManpowerPost
);

router.patch(
  "/my-posts/update/:id",
  verifyAccessToken,
  authorizeContractor,
  updateManpowerPostById
);

export default router;
