import Stripe from 'stripe';
import { buffer } from 'micro';
import admin from 'firebase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Initialize Firebase Admin SDK securely
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
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

  let event;
  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);

  try {
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook verification failed:', err.message);
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
        console.log(`Unhandled event: ${event.type}`);
    }

    res.status(200).send('Received');
  } catch (err) {
    console.error('Firestore error:', err.message);
    res.status(500).send('Internal Server Error');
  }
}
