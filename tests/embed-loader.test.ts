import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const loader = readFileSync(new URL("../public/embed.js", import.meta.url), "utf8");
const WIDGET_ORIGIN = "https://widget.example";

type FakeMessage = {
  origin: string;
  source: unknown;
  data: unknown;
};

type FakeFrame = {
  src: string;
  title: string;
  style: Record<string, string>;
  contentWindow: Record<string, never>;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
};

function createFrame(): FakeFrame {
  const attributes = new Map<string, string>();
  return {
    src: "",
    title: "",
    style: {},
    contentWindow: {},
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    getAttribute(name) {
      return attributes.get(name) ?? null;
    },
  };
}

function createHarness({
  readyState = "complete",
  scriptSrc = `${WIDGET_ORIGIN}/embed.js`,
}: { readyState?: string; scriptSrc?: string } = {}) {
  const frames: FakeFrame[] = [];
  const messageListeners = new Set<(event: FakeMessage) => void>();
  const domContentLoadedListeners = new Set<() => void>();

  const document = {
    currentScript: { src: scriptSrc },
    readyState,
    createElement(tagName: string) {
      if (tagName !== "iframe") throw new Error(`Unexpected element: ${tagName}`);
      return createFrame();
    },
    querySelector(selector: string) {
      if (selector !== "iframe[data-anssi-widget]") {
        throw new Error(`Unexpected selector: ${selector}`);
      }
      return (
        frames.find((frame) => frame.getAttribute("data-anssi-widget") !== null) ??
        null
      );
    },
    body: {
      appendChild(frame: FakeFrame) {
        frames.push(frame);
        return frame;
      },
    },
    addEventListener(type: string, listener: () => void) {
      if (type !== "DOMContentLoaded") throw new Error(`Unexpected event: ${type}`);
      domContentLoadedListeners.add(listener);
    },
  };

  const window = {
    addEventListener(type: string, listener: (event: FakeMessage) => void) {
      if (type !== "message") throw new Error(`Unexpected event: ${type}`);
      messageListeners.add(listener);
    },
  };

  return {
    frames,
    load() {
      vm.runInNewContext(loader, { window, document, URL });
    },
    emitDOMContentLoaded() {
      const listeners = [...domContentLoadedListeners];
      domContentLoadedListeners.clear();
      for (const listener of listeners) listener();
    },
    emitMessage(event: FakeMessage) {
      for (const listener of messageListeners) listener(event);
    },
    messageListenerCount() {
      return messageListeners.size;
    },
  };
}

function resizeMessage(open: boolean) {
  return { source: "anssi-widget", type: "resize", open };
}

describe("embed loader", () => {
  it("creates the confined iframe from the script URL", () => {
    const harness = createHarness();
    harness.load();

    expect(harness.frames).toHaveLength(1);
    const frame = harness.frames[0];
    expect(frame.src).toBe(`${WIDGET_ORIGIN}/embed`);
    expect(frame.title).toBe("Assistant ANSSI");
    expect(frame.getAttribute("sandbox")).toBe(
      "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox",
    );
    expect(frame.getAttribute("allow")).toBe(
      "camera 'none'; microphone 'none'; geolocation 'none'",
    );
    expect(frame.getAttribute("referrerpolicy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(frame.style).toMatchObject({
      position: "fixed",
      right: "16px",
      bottom: "16px",
      width: "88px",
      height: "88px",
      border: "0",
      zIndex: "50",
    });
  });

  it("waits for the body when loaded during document parsing", () => {
    const harness = createHarness({ readyState: "loading" });
    harness.load();
    expect(harness.frames).toHaveLength(0);

    harness.emitDOMContentLoaded();
    expect(harness.frames).toHaveLength(1);
    expect(harness.messageListenerCount()).toBe(1);
  });

  it("does not duplicate the frame or its listener when loaded twice", () => {
    const harness = createHarness();
    harness.load();
    harness.load();

    expect(harness.frames).toHaveLength(1);
    expect(harness.messageListenerCount()).toBe(1);
  });

  it("resizes only for valid messages from its own frame and origin", () => {
    const harness = createHarness();
    harness.load();
    const frame = harness.frames[0];
    const validEvent = {
      origin: WIDGET_ORIGIN,
      source: frame.contentWindow,
    };

    harness.emitMessage({ ...validEvent, data: resizeMessage(true) });
    expect(frame.style).toMatchObject({ width: "420px", height: "620px" });

    const invalidEvents: FakeMessage[] = [
      { origin: "https://attacker.example", source: frame.contentWindow, data: resizeMessage(false) },
      { origin: WIDGET_ORIGIN, source: {}, data: resizeMessage(false) },
      { ...validEvent, data: null },
      { ...validEvent, data: "resize" },
      { ...validEvent, data: { ...resizeMessage(false), source: "other" } },
      { ...validEvent, data: { ...resizeMessage(false), type: "other" } },
      { ...validEvent, data: { ...resizeMessage(false), open: "false" } },
    ];
    for (const event of invalidEvents) harness.emitMessage(event);
    expect(frame.style).toMatchObject({ width: "420px", height: "620px" });

    harness.emitMessage({ ...validEvent, data: resizeMessage(false) });
    expect(frame.style).toMatchObject({ width: "88px", height: "88px" });
  });

  it("uses the script origin, including a non-default port", () => {
    const origin = "https://widget.example:8443";
    const harness = createHarness({
      scriptSrc: `${origin}/assets/embed.js?version=1`,
    });
    harness.load();
    const frame = harness.frames[0];

    expect(frame.src).toBe(`${origin}/embed`);
    harness.emitMessage({
      origin,
      source: frame.contentWindow,
      data: resizeMessage(true),
    });
    expect(frame.style).toMatchObject({ width: "420px", height: "620px" });
  });
});
