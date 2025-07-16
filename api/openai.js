// /api/openai.js
import { Configuration, OpenAIApi } from "openai";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { prompt, model = "gpt-3.5-turbo", max_tokens = 500 } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt is required and must be a string." });
    }

    if (!["gpt-3.5-turbo", "gpt-4"].includes(model)) {
      return res.status(400).json({ error: "Invalid model requested." });
    }

    // Optional: Add your own premium check here
    // if (model === "gpt-4" && !isPremiumUser(req)) {
    //   return res.status(403).json({ error: "GPT-4 is a premium feature." });
    // }

    const completion = await openai.createChatCompletion({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens,
      temperature: 0.7,
    });

    const result = completion.data.choices?.[0]?.message?.content?.trim();

    res.status(200).json({ result });
  } catch (err) {
    console.error("🔴 OpenAI API Error:", err.response?.data || err.message);
    res.status(500).json({ error: "OpenAI API request failed." });
  }
}
