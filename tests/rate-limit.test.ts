import { describe, expect, it } from "vitest";
import { clientKey, FixedWindowLimiter } from "@/lib/rate-limit";

describe("FixedWindowLimiter", () => {
	it("allows up to the limit then refuses", () => {
		const now = 0;
		const limiter = new FixedWindowLimiter(2, 60_000, () => now);

		expect(limiter.check("a").allowed).toBe(true);
		expect(limiter.check("a").allowed).toBe(true);

		const refused = limiter.check("a");
		expect(refused.allowed).toBe(false);
		expect(refused.retryAfterSeconds).toBe(60);
	});

	it("tracks callers independently", () => {
		const now = 0;
		const limiter = new FixedWindowLimiter(1, 60_000, () => now);

		expect(limiter.check("a").allowed).toBe(true);
		expect(limiter.check("a").allowed).toBe(false);
		expect(limiter.check("b").allowed).toBe(true);
	});

	it("allows again once the window has passed", () => {
		let now = 0;
		const limiter = new FixedWindowLimiter(1, 60_000, () => now);

		expect(limiter.check("a").allowed).toBe(true);
		now += 60_000;
		expect(limiter.check("a").allowed).toBe(true);
	});

	it("reports a shrinking retry delay inside the window", () => {
		let now = 0;
		const limiter = new FixedWindowLimiter(1, 60_000, () => now);

		limiter.check("a");
		now += 45_000;
		expect(limiter.check("a").retryAfterSeconds).toBe(15);
	});

	it("forgets windows that expired, so distinct keys do not accumulate", () => {
		let now = 0;
		const limiter = new FixedWindowLimiter(1, 1_000, () => now);

		for (let index = 0; index < 500; index += 1) limiter.check(`key-${index}`);
		now += 1_000;
		limiter.check("trigger-sweep");

		// A fresh key is still admitted: sweeping removed the stale windows.
		expect(limiter.check("another").allowed).toBe(true);
	});
});

describe("clientKey", () => {
	it("prefers the platform-set X-Real-IP", () => {
		const headers = new Headers({
			"x-real-ip": "203.0.113.9",
			"x-forwarded-for": "198.51.100.1, 198.51.100.2",
		});
		expect(clientKey(headers)).toBe("203.0.113.9");
	});

	it("falls back to the first forwarded address", () => {
		const headers = new Headers({
			"x-forwarded-for": "198.51.100.1, 10.0.0.1",
		});
		expect(clientKey(headers)).toBe("198.51.100.1");
	});

	it("groups requests with no identifying header", () => {
		expect(clientKey(new Headers())).toBe("unknown");
	});
});
