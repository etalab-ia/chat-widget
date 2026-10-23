import { describe, expect, it } from "vitest";
import { parseAnswer, parseSpans, type AnswerSource } from "@/lib/render-answer";

const sources = new Map<number, AnswerSource>([
  [1, { marker: 1, url: "https://e.org/a.pdf#page=4", page: 4 }],
  [2, { marker: 2, url: "https://e.org/b.pdf", page: null }],
]);

describe("parseSpans", () => {
  it("turns a known marker into a citation span", () => {
    expect(parseSpans("La MFA est requise [1].", sources)).toEqual([
      { kind: "text", text: "La MFA est requise " },
      { kind: "citation", marker: 1, page: 4, url: "https://e.org/a.pdf#page=4" },
      { kind: "text", text: "." },
    ]);
  });

  it("splits runs of markers into one link each", () => {
    const spans = parseSpans("Recommandé [1][2].", sources);
    expect(spans.filter((span) => span.kind === "citation")).toHaveLength(2);
  });

  it("leaves an unknown marker as text", () => {
    // A link to nothing is worse than a bare number: the marker stays visible
    // but is not turned into an anchor.
    const spans = parseSpans("Voir [7].", sources);
    expect(spans).toEqual([{ kind: "text", text: "Voir [7]." }]);
  });

  it("carries an unknown page as null rather than guessing one", () => {
    const spans = parseSpans("[2]", sources);
    expect(spans).toEqual([
      { kind: "citation", marker: 2, page: null, url: "https://e.org/b.pdf" },
    ]);
  });

  it("returns the whole text when there is no marker", () => {
    expect(parseSpans("Aucune citation ici.", sources)).toEqual([
      { kind: "text", text: "Aucune citation ici." },
    ]);
  });
});

describe("parseAnswer", () => {
  it("strips bold markers instead of showing asterisks", () => {
    const blocks = parseAnswer("Une **authentification forte** est requise.");
    expect(blocks).toEqual([
      { kind: "paragraph", text: "Une authentification forte est requise." },
    ]);
  });

  it("strips italic and inline code markers", () => {
    const blocks = parseAnswer("Le *principe* et la commande `sshd` restent.");
    expect(blocks[0]).toEqual({
      kind: "paragraph",
      text: "Le principe et la commande sshd restent.",
    });
  });

  it("renders dash lists as bullets", () => {
    const blocks = parseAnswer("Recommandations :\n- premier point\n- second point");
    expect(blocks).toEqual([
      { kind: "paragraph", text: "Recommandations :" },
      { kind: "bullet", text: "premier point" },
      { kind: "bullet", text: "second point" },
    ]);
  });

  it("renders numbered items as ordered entries", () => {
    const blocks = parseAnswer("1. segmenter\n2. journaliser");
    expect(blocks.map((block) => block.kind)).toEqual(["ordered", "ordered"]);
    expect(blocks[1]).toEqual({ kind: "ordered", text: "journaliser", number: 2 });
  });

  it("keeps a list's own numbering when it follows another block", () => {
    const blocks = parseAnswer("Recommandations :\n1. segmenter\n2. journaliser");
    expect(blocks).toEqual([
      { kind: "paragraph", text: "Recommandations :" },
      { kind: "ordered", text: "segmenter", number: 1 },
      { kind: "ordered", text: "journaliser", number: 2 },
    ]);
  });

  it("honours a list that starts at a number other than one", () => {
    const blocks = parseAnswer("3. troisième\n4. quatrième");
    expect(blocks.map((block) => (block.kind === "ordered" ? block.number : null))).toEqual([3, 4]);
  });

  it("joins wrapped lines into one paragraph", () => {
    const blocks = parseAnswer("Une phrase\nqui continue ici.\n\nUn second paragraphe.");
    expect(blocks).toEqual([
      { kind: "paragraph", text: "Une phrase qui continue ici." },
      { kind: "paragraph", text: "Un second paragraphe." },
    ]);
  });

  it("drops heading markers", () => {
    const blocks = parseAnswer("## Synthèse\nLa MFA est requise.");
    expect(blocks[0]).toEqual({ kind: "paragraph", text: "Synthèse" });
  });

  it("keeps citations markers untouched", () => {
    const blocks = parseAnswer("La MFA est requise [1][2].");
    expect(blocks[0]).toEqual({
      kind: "paragraph",
      text: "La MFA est requise [1][2].",
    });
  });

  it("returns no block for empty input", () => {
    expect(parseAnswer("   ")).toEqual([]);
  });

  it("preserves colons and parentheses the model escapes", () => {
    const blocks = parseAnswer("Facteurs \\(FIDO2\\) : carte, OTP.");
    expect(blocks[0]).toEqual({
      kind: "paragraph",
      text: "Facteurs (FIDO2) : carte, OTP.",
    });
  });
});

describe("citation fallback decision", () => {
  // The widget shows the source list only when no marker resolved inline, so
  // this predicate is what keeps an uncited answer from losing its sources.
  const citesInline = (answer: string) =>
    parseSpans(answer, sources).some((span) => span.kind === "citation");

  it("reports inline citations when a marker resolves", () => {
    expect(citesInline("La MFA est requise [1].")).toBe(true);
  });

  it("falls back when the answer has no marker", () => {
    expect(citesInline("Une réponse sans citation.")).toBe(false);
  });

  it("falls back when the markers do not resolve", () => {
    // "[9]" points at nothing, so the inline path renders it as plain text and
    // the source list must still be shown.
    expect(citesInline("Voir [9].")).toBe(false);
  });
});
