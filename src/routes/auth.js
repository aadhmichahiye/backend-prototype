// routes/auth.js
import express from "express";
import {
  loginUser,
  refreshAccessToken,
  logout,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/login", loginUser); // client must call with withCredentials if cross-origin
router.post("/refresh", refreshAccessToken); // call with withCredentials and skipAuth on client
router.post("/logout", logout);

export default router;
