import Stripe from 'stripe';
import { buffer } from 'micro';
import admin from 'firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "aisaid",
      clientEmail: "firebase-adminsdk@aisaid.iam.gserviceaccount.com", // Replace with your actual Firebase clientEmail if different
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const session = event.data.object;
  const userId = session.client_reference_id || session.customer_email;

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await db.collection('users').doc(userId).set({ hasPaid: true }, { merge: true });
        break;

      case 'invoice.payment_failed':
      case 'customer.subscription.deleted':
        await db.collection('users').doc(userId).set({ hasPaid: false }, { merge: true });
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    res.status(200).send('✅ Webhook received and processed');
  } catch (err) {
    console.error('🔥 Firestore update error:', err.message);
    res.status(500).send('Error processing webhook');
  }
}
