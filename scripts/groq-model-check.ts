/**
 * One-off: verify AI_MODELS IDs against Groq's live model list and a minimal
 * chat completion. Run: npx tsx --env-file=.env scripts/groq-model-check.ts
 */
import { config } from "dotenv";
config({ path: ".env" });

// Keep in sync with lib/ai.ts
const AI_MODELS = {
  matching: "openai/gpt-oss-120b",
  screening: "openai/gpt-oss-120b",
  assessment: "openai/gpt-oss-120b",
  assessmentGrading: "openai/gpt-oss-120b",
  interview: "qwen/qwen3.8-27b",
  evaluation: "openai/gpt-oss-120b",
  jobGeneration: "qwen/qwen3.8-27b",
  stt: "whisper-large-v3-turbo",
} as const;

async function main() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY not set");
    process.exit(1);
  }

  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = (await res.json()) as { data?: { id: string }[]; error?: unknown };
  if (!data.data) {
    console.error("Failed to list models:", JSON.stringify(data));
    process.exit(1);
  }

  const available = new Set(data.data.map((m) => m.id));
  console.log(`Groq reports ${available.size} available models.\n`);

  for (const [feature, model] of Object.entries(AI_MODELS)) {
    console.log(`${available.has(model) ? "✅" : "❌"} ${feature.padEnd(18)} ${model}`);
  }

  const missing = Object.values(AI_MODELS).filter((m) => !available.has(m));
  if (missing.length > 0) {
    console.log(`\nMissing models: ${missing.join(", ")}`);
    process.exit(2);
  }

  // Live chat sanity check on the two models under scrutiny.
  for (const model of [AI_MODELS.jobGeneration, AI_MODELS.interview]) {
    const chatRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: 'Return json with exactly this shape: {"ok":true}' }],
        response_format: { type: "json_object" },
        max_completion_tokens: 20,
      }),
    });
    const chat = (await chatRes.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string };
    };
    const content = chat.choices?.[0]?.message?.content;
    if (!content) console.log(`   raw response: ${JSON.stringify(chat).slice(0, 400)}`);
    console.log(
      chatRes.ok && content
        ? `✅ live chat OK on ${model}: ${content.trim().slice(0, 60)}`
        : `❌ live chat FAILED on ${model}: ${chat.error?.message ?? chatRes.status}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
