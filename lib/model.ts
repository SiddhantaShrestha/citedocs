import { readFileSync } from "node:fs";
import path from "node:path";

const DIMS = 768;
const OLLAMA = "http://127.0.0.1:11434";

const prefix = {
  document: "search_document: ",
  query: "search_query: ",
} as const;

let envLoaded = false;

function loadEnv() {
  if (envLoaded) return;
  envLoaded = true;
  try {
    const text = readFileSync(path.join(process.cwd(), ".env"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // Next.js loads .env on its own. A missing file is fine.
  }
}

function provider() {
  loadEnv();
  const value = process.env.MODEL_PROVIDER ?? "ollama";
  if (value === "ollama" || value === "hosted") return value;
  throw new Error("MODEL_PROVIDER must be ollama or hosted.");
}

export function embeddingModelName() {
  return provider() === "hosted" ? "gemini-embedding-001" : "nomic-embed-text";
}

function unit(values: number[]) {
  let sum = 0;
  for (const value of values) sum += value * value;
  const length = Math.sqrt(sum);
  if (length === 0) return values;
  return values.map((value) => value / length);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson(url: string, body: unknown, headers: Record<string, string>) {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      if (attempt === 3) return null;
      await sleep(3000 * (attempt + 1));
      continue;
    }
    if (response.status !== 429 || attempt === 3) return response;
    const retryAfter = Number(response.headers.get("retry-after"));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 15000 * (attempt + 1);
    await sleep(wait);
  }
  return response ?? null;
}

async function embedOllama(texts: string[], kind: keyof typeof prefix) {
  const response = await postJson(`${OLLAMA}/api/embed`, {
    model: "nomic-embed-text",
    input: texts.map((text) => `${prefix[kind]}${text}`),
  }, {});
  if (!response) throw new Error("Ollama is not running. Start it, then try again.");
  if (!response.ok) {
    throw new Error("Ollama could not embed this text. Is nomic-embed-text pulled?");
  }
  const body = (await response.json()) as { embeddings?: number[][] };
  const embeddings = body.embeddings ?? [];
  if (embeddings.length !== texts.length) {
    throw new Error("Ollama returned the wrong number of embeddings.");
  }
  for (const embedding of embeddings) {
    if (embedding.length !== DIMS) throw new Error(`Expected a ${DIMS}-number embedding.`);
  }
  return embeddings;
}

let lastHostedCall = 0;

async function paceHosted() {
  const wait = 2000 - (Date.now() - lastHostedCall);
  if (wait > 0) await sleep(wait);
  lastHostedCall = Date.now();
}

async function embedHosted(texts: string[], kind: keyof typeof prefix) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Set GEMINI_API_KEY in .env to use MODEL_PROVIDER=hosted.");
  const taskType = kind === "document" ? "RETRIEVAL_DOCUMENT" : "RETRIEVAL_QUERY";
  const embeddings: number[][] = [];

  for (let start = 0; start < texts.length; start += 16) {
    const slice = texts.slice(start, start + 16);
    await paceHosted();
    const response = await postJson(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents",
      {
        requests: slice.map((text) => ({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: DIMS,
        })),
      },
      { "x-goog-api-key": key },
    );
    if (!response) throw new Error("Gemini could not be reached.");
    if (!response.ok) throw new Error(`Gemini could not embed this text (${response.status}).`);
    const body = (await response.json()) as { embeddings?: { values?: number[] }[] };
    const rows = body.embeddings ?? [];
    if (rows.length !== slice.length) {
      throw new Error("Gemini returned the wrong number of embeddings.");
    }
    for (const row of rows) {
      const values = unit(row.values ?? []);
      if (values.length !== DIMS) throw new Error(`Expected a ${DIMS}-number embedding.`);
      embeddings.push(values);
    }
  }

  return embeddings;
}

export async function embed(texts: string[], kind: keyof typeof prefix) {
  if (texts.length === 0) return [];
  if (provider() === "hosted") return embedHosted(texts, kind);
  return embedOllama(texts, kind);
}

async function generateOllama(system: string, user: string) {
  const response = await postJson(
    `${OLLAMA}/api/chat`,
    {
      model: "llama3.2",
      stream: false,
      options: { temperature: 0 },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    {},
  );
  if (!response) throw new Error("Ollama is not running. Start it, then try again.");
  if (!response.ok) throw new Error("Ollama could not write an answer. Is llama3.2 pulled?");
  const body = (await response.json()) as { message?: { content?: string } };
  return body.message?.content ?? "";
}

async function generateHosted(system: string, user: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Set GEMINI_API_KEY in .env to use MODEL_PROVIDER=hosted.");
  await paceHosted();
  const response = await postJson(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
    },
    { "x-goog-api-key": key },
  );
  if (!response) throw new Error("Gemini could not be reached.");
  if (!response.ok) throw new Error(`Gemini could not write an answer (${response.status}).`);
  const body = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part) => part.text ?? "").join("");
}

export async function generate(system: string, user: string) {
  if (provider() === "hosted") return generateHosted(system, user);
  return generateOllama(system, user);
}

export function toVectorLiteral(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}
