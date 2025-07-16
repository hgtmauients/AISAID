import { Configuration, OpenAIApi } from "openai";

const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(config);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { prompt, model = process.env.OPENAI_MODEL || "gpt-3.5-turbo" } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OpenAI API Key." });
  }

  try {
    const completion = await openai.createChatCompletion({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const result = completion.data.choices[0]?.message?.content?.trim() || "No response.";
    return res.status(200).json({ result });
  } catch (err) {
    console.error("❌ OpenAI error:", err?.response?.data || err.message || err);
    return res.status(500).json({
      error: err?.response?.data?.error?.message || "OpenAI request failed.",
    });
  }
}
