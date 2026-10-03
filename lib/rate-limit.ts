import { prisma } from "@/lib/db";

const hits = new Map<string, number[]>();

function remember(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

const MINUTE_MESSAGE = "Too many questions in a row. Please wait a minute and try again.";
const ACCOUNT_DAY_MESSAGE =
  "This shared account has reached today's question limit. Please try again tomorrow.";
const DEMO_DAY_MESSAGE =
  "This demo has reached today's question limit. Please try again tomorrow.";

export async function assertAskAllowed(userId: string) {
  const minuteAgo = new Date(Date.now() - 60_000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [minuteCount, dayCount, globalCount] = await Promise.all([
    prisma.question.count({ where: { userId, createdAt: { gte: minuteAgo } } }),
    prisma.question.count({ where: { userId, createdAt: { gte: dayAgo } } }),
    prisma.question.count({ where: { createdAt: { gte: dayAgo } } }),
  ]);

  if (globalCount >= 200) throw new Error(DEMO_DAY_MESSAGE);
  if (dayCount >= 40) throw new Error(ACCOUNT_DAY_MESSAGE);
  if (minuteCount >= 6) throw new Error(MINUTE_MESSAGE);

  if (!remember(`ask:${userId}:minute`, 6, 60_000)) throw new Error(MINUTE_MESSAGE);
  if (!remember(`ask:${userId}:day`, 40, 24 * 60 * 60 * 1000)) {
    throw new Error(ACCOUNT_DAY_MESSAGE);
  }
  if (!remember("ask:all:day", 200, 24 * 60 * 60 * 1000)) throw new Error(DEMO_DAY_MESSAGE);
}

export async function assertUploadAllowed(userId: string) {
  if (!remember(`upload:${userId}:hour`, 6, 60 * 60 * 1000)) {
    throw new Error("Upload limit reached. Try again in an hour.");
  }
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [hourCount, dayCount] = await Promise.all([
    prisma.document.count({ where: { createdAt: { gte: hourAgo } } }),
    prisma.document.count({ where: { createdAt: { gte: dayAgo } } }),
  ]);
  if (hourCount >= 6) throw new Error("Upload limit reached. Try again in an hour.");
  if (dayCount >= 20) throw new Error("Daily upload limit reached. Try again tomorrow.");
}
