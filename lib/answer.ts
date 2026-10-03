import { generate } from "@/lib/model";

const UNKNOWN = "I don't know. That is not in the documents you can see.";

export function cleanAnswer(answer: string) {
  return answer
    .replace(/\[\d+\]/g, "")
    .replace(/,\s*,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

function sentencesOf(text: string) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function asClause(sentence: string) {
  if (/^[A-Z][a-z]/.test(sentence)) {
    return sentence[0].toLowerCase() + sentence.slice(1);
  }
  return sentence;
}

export async function writeAnswer(
  question: string,
  sources: { title: string; text: string }[],
) {
  const lines = sources.flatMap((source, sourceIndex) =>
    sentencesOf(source.text).map((sentence) => ({
      title: source.title,
      sentence,
      sourceIndex,
    })),
  );
  if (lines.length === 0) return { answer: UNKNOWN, cited: [] as number[] };

  const numbered = lines
    .map((line, index) => `${index + 1}. ${line.sentence}`)
    .join("\n");

  const raw = cleanAnswer(
    await generate(
      "Reply with only the number of the sentence that answers the question. If none of them answer it, reply none.",
      `${numbered}\n\nQuestion: ${question}`,
    ),
  );
  if (/^none\b/i.test(raw)) return { answer: UNKNOWN, cited: [] };

  const match = raw.match(/\d+/);
  const line = match ? lines[Number(match[0]) - 1] : undefined;
  if (!line) return { answer: UNKNOWN, cited: [] };

  return {
    answer: `According to ${line.title}, ${asClause(line.sentence)}`,
    cited: [line.sourceIndex],
  };
}
