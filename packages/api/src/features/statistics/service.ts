import { count } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";

const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours
const LAST_KNOWN = {
	users: 978_528,
	resumes: 1_336_307,
} as const;

// ponytail: file-based disk cache replaced with module-level memo; LAST_KNOWN fallbacks cover restarts
const memCache = new Map<string, { value: number; cachedAt: number }>();

const getCached = (key: string): number | null => {
	const entry = memCache.get(key);
	if (!entry || Date.now() - entry.cachedAt >= CACHE_DURATION_MS) return null;
	return entry.value;
};

const setCached = (key: string, value: number) => {
	memCache.set(key, { value, cachedAt: Date.now() });
};

const getCachedCount = async (
	key: string,
	lastKnown: number,
	fetcher: () => Promise<number | null>,
): Promise<number> => {
	const cached = getCached(key);
	if (cached !== null) return cached;

	try {
		const value = await fetcher();
		if (value !== null) {
			setCached(key, value);
			return value;
		}
	} catch {
		// Ignore errors, use last known value
	}

	return lastKnown;
};

const getCountFromDatabase = async (table: typeof schema.user | typeof schema.resume): Promise<number | null> => {
	const [result] = await db.select({ count: count() }).from(table);
	if (!result) return null;
	return result.count;
};

export const statisticsService = {
	user: {
		getCount: () => {
			return getCachedCount("users", LAST_KNOWN.users, () => getCountFromDatabase(schema.user));
		},
	},
	resume: {
		getCount: () => {
			return getCachedCount("resumes", LAST_KNOWN.resumes, () => getCountFromDatabase(schema.resume));
		},
	},
};
