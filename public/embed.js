(() => {
  "use strict";

  const script = document.currentScript;
  if (!script) return;

  let widgetUrl;
  try {
    widgetUrl = new URL("/embed", script.src);
  } catch {
    return;
  }

  const widgetOrigin = widgetUrl.origin;
  const frameSelector = "iframe[data-anssi-widget]";

  function mount() {
    // A host can include the tag twice, or Next.js can remount the demo page.
    // Keep one frame and, importantly, one message listener.
    if (document.querySelector(frameSelector)) return;

    const frame = document.createElement("iframe");
    frame.src = widgetUrl.href;
    frame.title = "Assistant ANSSI";
    frame.setAttribute("data-anssi-widget", "");
    frame.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox",
    );
    frame.setAttribute(
      "allow",
      "camera 'none'; microphone 'none'; geolocation 'none'",
    );
    frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");

    Object.assign(frame.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      width: "88px",
      height: "88px",
      border: "0",
      zIndex: "50",
      background: "transparent",
      transition: "width 160ms ease, height 160ms ease",
    });

    function onMessage(event) {
      if (event.origin !== widgetOrigin) return;
      if (event.source !== frame.contentWindow) return;

      const data = event.data;
      if (!data || data.source !== "anssi-widget" || data.type !== "resize") {
        return;
      }
      if (typeof data.open !== "boolean") return;

      frame.style.width = data.open ? "420px" : "88px";
      frame.style.height = data.open ? "620px" : "88px";
    }

    // Listen before attaching the frame so even an immediate resize announcement
    // from the widget cannot be missed.
    window.addEventListener("message", onMessage);
    document.body.appendChild(frame);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
