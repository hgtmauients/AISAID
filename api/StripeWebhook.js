import Stripe from "stripe";
import admin from "firebase-admin";
import { buffer } from "micro";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.firestore();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const sig = req.headers["stripe-signature"];
  const buf = await buffer(req);
  let event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const session = event.data.object;

  try {
    switch (event.type) {
      case "checkout.session.completed":
        if (session.customer_email) {
          await db.collection("users").doc(session.customer_email).set(
            {
              hasPaid: true,
              stripeCustomerId: session.customer,
              lastCheckout: new Date().toISOString(),
              plan: session.metadata?.plan || "monthly"
            },
            { merge: true }
          );
          console.log(`✅ Payment completed for ${session.customer_email}`);
        }
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionStatusChange(session.customer, false);
        break;

      case "invoice.payment_failed":
        await handleSubscriptionStatusChange(session.customer, false);
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error("🔥 Error processing webhook:", err);
  }

  res.status(200).send("Webhook received");
}

// Helper: Update hasPaid by Stripe customer ID
async function handleSubscriptionStatusChange(customerId, isActive) {
  const usersRef = db.collection("users");
  const snapshot = await usersRef.where("stripeCustomerId", "==", customerId).get();

  if (snapshot.empty) {
    console.warn(`⚠️ No user found with Stripe customer ID: ${customerId}`);
    return;
  }

  for (const doc of snapshot.docs) {
    await doc.ref.set({ hasPaid: isActive }, { merge: true });
    console.log(`🔄 Updated hasPaid=${isActive} for ${doc.id}`);
  }
}
