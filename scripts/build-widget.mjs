import { build } from "esbuild";

// React and assistant-ui are bundled: the host need not install any framework.
await build({
	entryPoints: ["widget/element.tsx"],
	outfile: "public/widget.js",
	bundle: true,
	format: "esm",
	platform: "browser",
	target: ["es2022"],
	minify: true,
	define: { "process.env.NODE_ENV": '"production"' },
	legalComments: "linked",
});
