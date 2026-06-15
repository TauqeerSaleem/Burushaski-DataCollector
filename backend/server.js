// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import webpush from "web-push";
import { startCronJobs } from "./jobs/cronJobs.js";
import adminRoutes from "./routes/admin.js";
import reminderRoutes from "./routes/reminders.js";
import userRoutes from "./routes/users.js";
import { supabase } from "./supabaseClient.js";

dotenv.config();

const app = express();

function allowedOrigins() {
  const configuredOrigins = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_ORIGIN;

  if (!configuredOrigins) return true;

  return configuredOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

// ============================================
// MIDDLEWARE
// ============================================
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: allowedOrigins() }));

// ============================================
// CONFIGURE WEB PUSH
// ============================================
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || process.env.VITE_VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:your-research-email@example.com",
    vapidPublicKey,
    vapidPrivateKey
  );
}

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

function healthCheck(req, res) {
  res.json({ status: "✅ OK", timestamp: new Date().toISOString() });
}

app.get("/health", healthCheck);
app.get("/api/health", healthCheck);

// ============================================
// API ROUTES
// ============================================
app.use("/api", reminderRoutes);
app.use("/api", userRoutes);
app.use("/api", adminRoutes);

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================
app.use((err, req, res, next) => {
  void next;
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

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startCronJobs(supabase);
  });
}

export default app;
