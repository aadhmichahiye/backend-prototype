import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./src/config/db.js";
import otpRoutes from "./src/routes/otpRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import jobPostRoutes from "./src/routes/clientJobPostRoutes.js";
import manpowerPost from "./src/routes/contractorManPowerPostRoutes.js";
import availableWorkers from "./src/routes/contractorAvailableWorkerRoutes.js";
import requiredWorkers from "./src/routes/clientRequiredWorkersEoutes.js";
import cookieParser from "cookie-parser";
import authRoute from "./src/routes/auth.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Be explicit with CORS

const allowed = [
  "http://localhost:5173",
  "https://aadhmichahiye.com",
  "https://dev.aadhmichahiye.com",
  "https://www.aadhmichahiye.com",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow curl/postman or same-origin requests
      if (allowed.indexOf(origin) !== -1) return callback(null, true);
      return callback(new Error("CORS not allowed"), false);
    },
    credentials: true,
  })
);
// app.use(cookieParser());

// example CORS enabling (Express)
// app.use(cors({
//   origin: process.env.CLIENT_ORIGIN, // e.g. https://yourfrontend.com
//   credentials: true,
// }));

app.use(cookieParser());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("🚀 Backend Prototype Running");
});

app.use("/api/auth", authRoute);
app.use("/api/otp", otpRoutes);
app.use("/api/user", userRoutes);
app.use("/api/client-job-posts", jobPostRoutes);
app.use("/api/contractor-manpower-posts", manpowerPost);
app.use("/api/contractor-workers", availableWorkers);
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
