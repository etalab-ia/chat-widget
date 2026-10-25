"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
	interface Window {
		__anssiWidget?: {
			mount: () => void;
			destroy: () => void;
		};
	}
}

/**
 * Uses the public loader so the demo exercises exactly the integration offered
 * to host pages, rather than maintaining a second iframe and resize bridge.
 */
export function EmbedFrame() {
	const active = useRef(false);

	const mountIfActive = () => {
		// A script that finishes downloading after unmount must not recreate the
		// widget. Plain host script tags keep the default auto-mount.
		if (active.current) window.__anssiWidget?.mount();
	};

	useEffect(() => {
		active.current = true;
		// This call covers a cached next/script on a later mount. The load/ready
		// paths cover the initial download; all three paths are idempotent.
		window.__anssiWidget?.mount();
		return () => {
			active.current = false;
			window.__anssiWidget?.destroy();
		};
	}, []);

	return (
		<Script
			src="/embed.js"
			strategy="afterInteractive"
			referrerPolicy="strict-origin-when-cross-origin"
			data-anssi-auto-mount="false"
			// When one instance takes over another's pending ScriptCache download,
			// Next calls the new instance's onLoad but not its onReady. Cover both.
			onLoad={mountIfActive}
			onReady={mountIfActive}
		/>
	);
}
