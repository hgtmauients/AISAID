import Stripe from "stripe";
import admin from "firebase-admin";
import { buffer } from "micro";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: "https://aisaid.firebaseio.com"
  });
}

const db = admin.firestore();
const stripe = new Stripe("sk_test_YOUR_SECRET_KEY_HERE"); // 🔁 Replace with real key
const endpointSecret = "whsec_YOUR_WEBHOOK_SECRET_HERE";   // 🔁 Replace with real secret

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  let event;
  const sig = req.headers["stripe-signature"];

  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error("❌ Webhook verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const session = event.data.object;
  const userId = session.client_reference_id || session.customer_email;

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await db.collection("users").doc(userId).set(
          { hasPaid: true },
          { merge: true }
        );
        console.log(`✅ Marked paid: ${userId}`);
        break;

      case "invoice.payment_failed":
      case "customer.subscription.deleted":
        await db.collection("users").doc(userId).set(
          { hasPaid: false },
          { merge: true }
        );
        console.log(`⚠️ Marked unpaid: ${userId}`);
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("🔥 Firestore update error:", err.message);
  }

  res.status(200).send("Received");
}
