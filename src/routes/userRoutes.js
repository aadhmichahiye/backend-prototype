import express from "express";
import {
  changeUserPin,
  createUser,
  getProfileInfo,
  loginUser,
  updateUserProfile,
} from "../controllers/userController.js";
import { verifyAccessToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", createUser);
router.put("/profile/update", verifyAccessToken, updateUserProfile);
router.post("/profile/update/pin", verifyAccessToken, changeUserPin);
router.get("/profile", verifyAccessToken, getProfileInfo);
router.post("/login", loginUser);

export default router;
