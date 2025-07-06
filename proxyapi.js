// /api/proxy.js

import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

// ✅ Firebase config using environment variables (set in Vercel)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID, // optional
};

if (!getApps().length) {
  initializeApp(firebaseConfig);
}

const db = getFirestore();

// ✅ Checks Firestore field `hasPaid: true`
async function checkUserSubscription(userId) {
  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() && userSnap.data().hasPaid === true;
}

export default async function handler(req, res) {
  // ✅ CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-extension-id, x-extension-user-id");

  if (req.method === "OPTIONS") {
    return res.status(200).end(); // Handle CORS preflight
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const extensionId = req.headers["x-extension-id"];
  const userId = req.headers["x-extension-user-id"];

  // ✅ Replace with your actual Chrome extension ID
  const allowedExtensionId = "your-chrome-extension-id-here";

  if (extensionId !== allowedExtensionId) {
    return res.status(403).json({ error: "Forbidden: Invalid Extension ID" });
  }

  if (!userId) {
    return res.status(400).json({ error: "Missing user ID" });
  }

  const hasPaid = await checkUserSubscription(userId);
  if (!hasPaid) {
    return res.status(403).json({ error: "User subscription inactive" });
  }

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(req.body),
    });

    const data = await openaiRes.json();
    return res.status(openaiRes.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: "OpenAI request failed", detail: error.message });
  }
}
