import { describe, expect, it } from "vitest";
import { parseAnswer } from "@/lib/render-answer";

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
    expect(blocks[1]).toEqual({ kind: "ordered", text: "journaliser" });
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
