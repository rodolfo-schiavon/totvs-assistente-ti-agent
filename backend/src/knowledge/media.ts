import { resolveOpenAiConfig, visionModelFromConfig } from "../services/openai-config";

export async function describeImage(buffer: Buffer, mimeType: string): Promise<string> {
  const cfg = await resolveOpenAiConfig();
  if (!cfg) return "";
  const b64 = buffer.toString("base64");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: visionModelFromConfig(cfg),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Descreva o conteúdo desta imagem em português, incluindo texto visível (OCR) se houver.",
            },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${b64}` } },
          ],
        },
      ],
      max_tokens: 800,
    }),
  });
  if (!res.ok) return "";
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() || "";
}

export async function transcribeMedia(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
  const cfg = await resolveOpenAiConfig();
  if (!cfg) return "";
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType || "application/octet-stream" });
  form.append("file", blob, fileName);
  form.append("model", process.env.WHISPER_MODEL || "whisper-1");
  form.append("language", "pt");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    body: form,
  });
  if (!res.ok) return "";
  const data = (await res.json()) as { text?: string };
  return data.text?.trim() || "";
}
