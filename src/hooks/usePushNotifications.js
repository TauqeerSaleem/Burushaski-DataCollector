import { supabase } from "../utils/supabase";

export async function subscribeToPush(user) {
  try {

    // 1️⃣ Check browser support
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.log("Push notifications not supported");
      return null;
    }

    // 2️⃣ Request permission
    const permission = Notification.permission;
    if (permission === "denied") {
      console.log("Notifications denied by user");
      return null;
    }

    if (permission === "default") {
      const result = await Notification.requestPermission();
      if (result !== "granted") return null;
    }

    // 3️⃣ Register service worker
    const registration = await navigator.serviceWorker.ready;

    // 4️⃣ Get existing subscription or create new
    let subscription = await registration.pushManager.getSubscription();


    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          import.meta.env.VITE_VAPID_PUBLIC_KEY
        ),
      });
    }

    
    // 5️⃣ Store subscription in Supabase
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        participant_id: user.participantId,
        subscription_json: JSON.stringify(subscription),
        updated_at: new Date(),
      },
      {
        onConflict: "participant_id",
      }
    );

    if (error) throw error;

    console.log("✅ Push subscription saved");
    return subscription;
  } catch (err) {
    console.error("❌ Push subscription failed:", err);
    return null;
  }
}

// Helper: Convert VAPID key format
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function unsubscribeFromPush(participantId) {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
    }

    // Remove from DB
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("participant_id", participantId);

    console.log("✅ Unsubscribed from push");
  } catch (err) {
    console.error("❌ Unsubscribe failed:", err);
  }
}