import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { userEmail, extensionId } = req.body;

  if (!userEmail || extensionId !== process.env.CHROME_EXTENSION_ID) {
    return res.status(400).json({ error: "Invalid request data" });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID, // from Stripe Dashboard
          quantity: 1
        }
      ],
      success_url: `${process.env.BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/cancel.html`,
      customer_email: userEmail,
      metadata: {
        extensionId,
        userEmail
      }
    });

    res.status(200).json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: "Stripe session creation failed", detail: error.message });
  }
}
