// Función serverless de Vercel: recibe { prompt } y devuelve { text } desde Claude.
// La clave vive solo en el servidor (variable de entorno ANTHROPIC_API_KEY).

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_PROMPT_CHARS = 20000;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Falta configurar ANTHROPIC_API_KEY en el servidor." });
  }

  const prompt = req.body && req.body.prompt;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "Solicitud inválida." });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return res.status(413).json({ error: "El texto es demasiado largo." });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (r.status === 429) return res.status(429).json({ error: "Demasiadas solicitudes. Espera unos segundos e intenta de nuevo." });
    if (!r.ok) {
      const detail = await r.text();
      console.error("Anthropic API error", r.status, detail);
      return res.status(502).json({ error: "La IA no pudo responder. Intenta de nuevo." });
    }

    const data = await r.json();
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    return res.status(200).json({ text });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error interno del servidor." });
  }
};
