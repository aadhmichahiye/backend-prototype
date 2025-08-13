import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./src/config/db.js";
import otpRoutes from "./src/routes/otpRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import jobPostRoutes from "./src/routes/jobPostRoutes.js";
import manpowerPost from "./src/routes/manpowerPostRoutes.js";
import availableWorkers from "./src/routes/availableWorkerRoutes.js";
import requiredWorkers from "./src/routes/requiredWorkerRoute.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Be explicit with CORS
app.use(cors());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  console.log("Auth endpoint hit");
  res.send("🚀 Backend Prototype Running");
});

app.use("/api/otp", otpRoutes);
app.use("/api/user", userRoutes);
app.use("/api/job-posts", jobPostRoutes);
app.use("/api/manpower-post", manpowerPost);
app.use("/api/workers", availableWorkers);
app.use("/api/required-workers", requiredWorkers);

app.listen(PORT, async () => {
  try {
    await connectDB();
    console.log("✅ MongoDB Connected");
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  } catch (err) {
    console.error("❌ DB Connection Failed", err.message);
    process.exit(1);
  }
});
