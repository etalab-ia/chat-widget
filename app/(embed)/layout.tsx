import "./embed-styles.css";

/**
 * Root layout for `/embed`.
 *
 * It deliberately carries no DSFR. That stylesheet resets every `button`
 * (appearance, border, background) and colours text by inheritance, and because
 * its rules sit outside any cascade layer they beat Tailwind's utilities no
 * matter which class the widget declares. Loading DSFR here is what made the
 * launcher pale on hover and left the send button transparent.
 *
 * Next allows one root layout per route group, so the site keeps DSFR and this
 * route does not. Nothing here uses Tailwind utility classes: this route's
 * stylesheet scans the widget components only, so the document's own base
 * styles live in embed-styles.css as plain rules.
 */
export default function EmbedRootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="fr">
			<body>{children}</body>
		</html>
	);
}
