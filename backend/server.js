// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { startCronJobs } from "./jobs/cronJobs.js";
import reminderRoutes from "./routes/reminders.js";
import userRoutes from "./routes/users.js";

dotenv.config();

const app = express();

// ============================================
// MIDDLEWARE
// ============================================
app.use(express.json());
app.use(cors());

// ============================================
// INITIALIZE SUPABASE
// ============================================
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

console.log("✅ Supabase initialized");

// ============================================
// CONFIGURE WEB PUSH
// ============================================
webpush.setVapidDetails(
  "mailto:your-research-email@example.com",
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VITE_VAPID_PRIVATE_KEY
);

console.log("✅ Web Push configured");

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================
app.get("/", (req, res) => {
  res.json({
    status: "🚀 Server is running!",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "GET /health",
      sendReminder: "POST /api/send-reminder",
      signup: "POST /api/users/signup",
      login: "POST /api/users/login",
      subscriptions: "GET /api/subscriptions",
      logs: "GET /api/notification-logs",
    },
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "✅ OK", timestamp: new Date().toISOString() });
});

// ============================================
// API ROUTES
// ============================================
app.use("/api", reminderRoutes);
app.use("/api", userRoutes);

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================
app.use((err, req, res, next) => {
  console.error("❌ ERROR:", err.message);
  console.error("Stack:", err.stack);

  res.status(500).json({
    error: err.message,
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`\n`);
  console.log(`╔════════════════════════════════════╗`);
  console.log(`║  🎤 BURUSHASKI REMINDER SERVER    ║`);
  console.log(`║  🚀 Running on port ${PORT}            ║`);
  console.log(`║  📡 http://localhost:${PORT}           ║`);
  console.log(`╚════════════════════════════════════╝`);
  console.log(`\n`);

  // Start cron jobs
  startCronJobs(supabase);
});

export { supabase };
