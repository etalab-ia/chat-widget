import type { NextConfig } from "next";
import { parseAllowedParents } from "./lib/embed-bridge";

/**
 * Host pages allowed to frame `/embed`, comma-separated in
 * `EMBED_ALLOWED_PARENTS`. Read once when the configuration is loaded, which is
 * also when the widget's own default inlined value is fixed: redeploy to change
 * the list. `/` is always allowed, since the demo page frames its own widget.
 */
const allowedParents = parseAllowedParents(process.env.EMBED_ALLOWED_PARENTS);
const frameAncestors = ["'self'", ...allowedParents].join(" ");

/**
 * The widget needs no device API, so every one of them is refused rather than
 * left to the browser default. A same-origin iframe would otherwise inherit
 * whatever the host page holds.
 */
const PERMISSIONS_POLICY = [
	"camera=()",
	"microphone=()",
	"geolocation=()",
	"display-capture=()",
	"clipboard-read=()",
	"payment=()",
	"usb=()",
	"serial=()",
	"hid=()",
	"bluetooth=()",
	"midi=()",
	"accelerometer=()",
	"gyroscope=()",
	"magnetometer=()",
	"idle-detection=()",
	"speaker-selection=()",
].join(", ");

const nextConfig: NextConfig = {
	// The container image runs the standalone server, which needs the traced
	// dependencies next to it rather than a full node_modules tree.
	output: "standalone",
	cacheComponents: true,
	partialPrefetching: true,
	turbopack: {
		rules: {
			"*.css": {
				loaders: ["@tailwindcss/turbopack"],
				as: "*.css",
			},
		},
	},
	async headers() {
		return [
			// Public code and styles contain no credentials. Only the chat API
			// requires an exact host allowlist, configured at service startup.
			{
				source: "/widget.:extension(js|css)",
				headers: [
					{ key: "Access-Control-Allow-Origin", value: "*" },
					{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
				],
			},
			{
				source: "/:path*",
				headers: [
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
					{ key: "Permissions-Policy", value: PERMISSIONS_POLICY },
				],
			},
			{
				// The widget accepts being framed only by the sites named here. This is
				// the control that actually bounds who can show it, so it is a response
				// header and not an attribute the embedding page chooses.
				source: "/embed",
				headers: [
					{
						key: "Content-Security-Policy",
						value: `frame-ancestors ${frameAncestors}; frame-src 'none'`,
					},
				],
			},
			{
				// The demo page is not meant to be framed anywhere.
				source: "/",
				headers: [
					{
						key: "Content-Security-Policy",
						value: "frame-ancestors 'none'; frame-src 'self'",
					},
					// For browsers that predate `frame-ancestors`. `/embed` deliberately
					// has no `X-Frame-Options`: it cannot name an allowed parent, so it
					// would either block the intranet or allow every site.
					{ key: "X-Frame-Options", value: "DENY" },
				],
			},
		];
	},
};

export default nextConfig;
