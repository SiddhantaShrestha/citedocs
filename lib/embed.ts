const OLLAMA_URL = "http://127.0.0.1:11434/api/embed";
const MODEL = "nomic-embed-text";
const DIMS = 768;

const prefix = {
  document: "search_document: ",
  query: "search_query: ",
} as const;

export async function embedTexts(
  texts: string[],
  kind: keyof typeof prefix,
) {
  if (texts.length === 0) return [];

  let response: Response;
  try {
    response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        input: texts.map((text) => `${prefix[kind]}${text}`),
      }),
    });
  } catch {
    throw new Error("Ollama is not running. Start it, then try again.");
  }

  if (!response.ok) {
    throw new Error("Ollama could not embed this document. Is nomic-embed-text pulled?");
  }

  const body = (await response.json()) as { embeddings?: number[][] };
  const embeddings = body.embeddings ?? [];
  if (embeddings.length !== texts.length) {
    throw new Error("Ollama returned the wrong number of embeddings.");
  }
  for (const embedding of embeddings) {
    if (embedding.length !== DIMS) {
      throw new Error(`Expected a ${DIMS}-number embedding.`);
    }
  }
  return embeddings;
}

export function toVectorLiteral(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}
