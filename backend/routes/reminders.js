// backend/routes/reminders.js
import express from "express";
import webpush from "web-push";
import { hasSupabaseConfig, supabase } from "../supabaseClient.js";

const router = express.Router();

function requireAdminApiKey(req, res, next) {
  const configuredKey = process.env.ADMIN_API_KEY;

  if (!configuredKey) {
    return res.status(503).json({
      error: "Admin API is not configured.",
    });
  }

  if (req.get("x-admin-api-key") !== configuredKey) {
    return res.status(401).json({
      error: "Admin API key is required.",
    });
  }

  return next();
}

function requireSupabase(req, res, next) {
  if (!hasSupabaseConfig || !supabase) {
    return res.status(500).json({
      error: "Admin API requires Supabase backend environment variables.",
    });
  }

  return next();
}

// ============================================
// POST /api/send-reminder
// Send push notifications to users
// ============================================
/**
 * Send reminder notifications
 *
 * Request body:
 * {
 *   "participantIds": ["P-001", "P-002"],  // Empty array = ALL users
 *   "title": "Time to Record!",
 *   "body": "You have 5 sentences left..."
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "sent": 5,
 *   "failed": 0,
 *   "total": 5
 * }
 */
router.post("/send-reminder", requireAdminApiKey, requireSupabase, async (req, res) => {
  try {
    const { participantIds = [], title, body } = req.body;

    // ✅ Validate input
    if (!title || !body) {
      return res.status(400).json({
        error: "Missing required fields: title and body",
      });
    }

    console.log("📡 Received reminder request");
    console.log(`   Title: "${title}"`);
    console.log(`   Body: "${body}"`);
    console.log(
      `   Target: ${participantIds.length > 0 ? participantIds.length + " users" : "ALL users"}`
    );

    // 📥 Query Supabase for subscriptions
    let query = supabase
      .from("push_subscriptions")
      .select("participant_id, subscription_json");

    // Filter by specific users if provided
    if (participantIds.length > 0) {
      query = query.in("participant_id", participantIds);
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      console.error("❌ Database error:", error);
      return res.status(500).json({ error: `Database error: ${error.message}` });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("⚠️  No subscriptions found");
      return res.status(200).json({
        success: true,
        sent: 0,
        failed: 0,
        total: 0,
        message: "No subscriptions found",
      });
    }

    console.log(`\n📬 Found ${subscriptions.length} subscription(s)\n`);

    let sent = 0;
    let failed = 0;

    // 🚀 Send to each user
    for (const sub of subscriptions) {
      try {
        const subscription = JSON.parse(sub.subscription_json);

        // Send push notification
        await webpush.sendNotification(
          subscription,
          JSON.stringify({ title, body })
        );

        sent++;
        console.log(`   ✅ ${sub.participant_id}`);

        // 📝 Log successful send
        await supabase.from("notification_logs").insert({
          participant_id: sub.participant_id,
          title,
          body,
          status: "sent",
        });
      } catch (err) {
        failed++;
        console.error(`   ❌ ${sub.participant_id}: ${err.message}`);

        // 📝 Log failure
        await supabase.from("notification_logs").insert({
          participant_id: sub.participant_id,
          title,
          body,
          status: "failed",
          error_message: err.message,
        });

        // If subscription is invalid (410), delete it
        if (err.statusCode === 410) {
          console.log(`   🗑️  Deleting invalid subscription for ${sub.participant_id}`);
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("participant_id", sub.participant_id);
        }
      }
    }

    console.log(`\n📊 Summary: ${sent} sent, ${failed} failed\n`);

    return res.json({
      success: true,
      sent,
      failed,
      total: subscriptions.length,
    });
  } catch (error) {
    console.error("❌ Endpoint error:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /api/subscriptions
// Check how many users are subscribed
// ============================================
router.get("/subscriptions", requireAdminApiKey, requireSupabase, async (req, res) => {
  try {
    const { count, error } = await supabase
      .from("push_subscriptions")
      .select("*", { count: "exact", head: true });

    if (error) throw error;

    res.json({
      subscribedUsers: count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /api/notification-logs
// View recent notification sends
// ============================================
router.get("/notification-logs", requireAdminApiKey, requireSupabase, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("notification_logs")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({
      count: data.length,
      logs: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
