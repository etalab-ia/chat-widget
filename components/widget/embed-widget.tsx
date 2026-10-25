"use client";

import { useCallback, useEffect } from "react";
import {
	EMBED_MESSAGE_SOURCE,
	type EmbedResizeMessage,
	resolveTargetOrigin,
} from "@/lib/embed-bridge";
import { AssistantModal } from "./assistant-modal";

/**
 * Widget entry point for the /embed route. It reports its collapsed/expanded
 * state to the parent document so the host can size the iframe.
 */
export function EmbedWidget({
	allowedParents = [],
}: {
	allowedParents?: readonly string[];
}) {
	const announce = useCallback(
		(open: boolean) => {
			if (typeof window === "undefined" || window.parent === window) return;

			const message: EmbedResizeMessage = {
				source: EMBED_MESSAGE_SOURCE,
				type: "resize",
				open,
			};
			window.parent.postMessage(
				message,
				resolveTargetOrigin({
					ownOrigin: window.location.origin,
					allowedParents,
					referrer: document.referrer,
				}),
			);
		},
		[allowedParents],
	);

	useEffect(() => {
		announce(false);
	}, [announce]);

	return <AssistantModal onOpenChange={announce} />;
}
