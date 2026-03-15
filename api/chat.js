// Vercel Serverless Function — SiamClones Chatbot API
// POST /api/chat → returns { text: "..." }
// GET /api/chat → returns { status: "ok" } (health check)

const SYSTEM_PROMPT = `You are the friendly, knowledgeable support assistant for SiamClones (siamclones.com) — Thailand's premier peer-to-peer marketplace for verified cannabis clones, premium seeds, and craft buds.

Your Identity: SiamClones Assistant. Friendly, helpful, chill but professional. If the user writes in Thai, reply in Thai. If in English, reply in English.

What SiamClones Is: A P2P marketplace connecting cannabis growers in Thailand with verified clone vendors, seed banks, and craft bud producers.

Product Categories:
1. Clones — Live cannabis cuttings from verified growers (per clone, per pack)
2. Seeds — Cannabis seeds from seed banks (per seed, per pack)
3. Buds — Craft cannabis flower (per gram, per ounce, per 100g)

How Ordering Works: Browse → add to cart → checkout with delivery address → choose COD or PromptPay → vendor ships in 24-48h → delivery in 1-3 business days.

Payment: PromptPay QR (instant via Thai banking app) or Cash on Delivery (COD, available everywhere in Thailand). Currency: THB.

Delivery: 24-48h dispatch, 1-3 days delivery, all 77 provinces. Tracking via LINE.

Returns: Contact within 24 hours if wrong/damaged item.

Selling: Visit siamclones.com/seller.html to become a vendor.

Rules: Don't make up prices. Don't guarantee delivery dates. Don't give medical/legal advice. If unsure, suggest contacting the seller via LINE.

Keep responses concise (2-4 sentences). Use emoji sparingly.`;

const rateLimit = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now - entry.start > 60000) {
    rateLimit.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= 20;
}

module.exports = async function handler(req, res) {
  const allowedOrigins = ['https://siamclones.com', 'https://www.siamclones.com', 'https://bloom-marketplace.vercel.app'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://siamclones.com');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Health check
  if (req.method === 'GET') {
    const hasKey = !!process.env.GEMINI_API_KEY;
    return res.status(200).json({ status: 'ok', configured: hasKey, node: process.version });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Chatbot not configured. Set GEMINI_API_KEY in Vercel env vars.' });
  }

  try {
    const { messages } = req.body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const recentMessages = messages.slice(-20);
    const contents = recentMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { temperature: 0.7, topP: 0.9, maxOutputTokens: 512 }
      })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini error:', geminiRes.status, errText);
      return res.status(502).json({ error: 'AI service temporarily unavailable. Please try again.' });
    }

    const data = await geminiRes.json();

    // Check for safety blocks or empty responses with specific messaging
    const candidate = data?.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const text = candidate?.content?.parts?.[0]?.text;

    if (finishReason === 'SAFETY') {
      return res.status(200).json({ text: "I can't answer that question, but I'm happy to help with anything about SiamClones — our products, ordering, shipping, or selling. What can I help you with? 🌿" });
    }

    if (!text) {
      console.error('Empty Gemini response:', JSON.stringify(data).substring(0, 500));
      if (finishReason === 'RECITATION') {
        return res.status(200).json({ text: "I wasn't able to generate a response for that. Could you try rephrasing your question? I'm here to help with anything about SiamClones! 🌱" });
      }
      return res.status(502).json({ error: 'No response from AI. Please try again in a moment.' });
    }

    // Return plain JSON — simple and reliable
    return res.status(200).json({ text });

  } catch (err) {
    console.error('Chat API error:', err.message || err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
