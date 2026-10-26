import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/browser",
	fullyParallel: false,
	use: {
		baseURL: "http://127.0.0.1:4310",
		launchOptions: {
			executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
		},
	},
	webServer: [
		{
			command: "pnpm exec next start --hostname 127.0.0.1 --port 4310",
			url: "http://127.0.0.1:4310",
			env: {
				WIDGET_ALLOWED_ORIGINS: "http://127.0.0.1:4311",
				ALBERT_API_KEY: "",
				ALBERT_COLLECTION_FR: "",
			},
		},
		{ command: "node tests/browser/host.mjs", url: "http://127.0.0.1:4311" },
	],
});
