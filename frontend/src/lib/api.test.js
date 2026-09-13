import { resolveBackendUrl, API, WS_API } from "./api";
test.each(["bksistem.space", "www.bksistem.space", "yeni.bksistem.space", "app.bksistem.space", "panel.bksistem.space", "portal.bksistem.space"])("%s uses its own proxy instead of stale environment settings", hostname => {
  expect(resolveBackendUrl({ hostname, origin: `https://${hostname}` }, "https://old.invalid/")).toBe(`https://${hostname}`);
});
test("local preview without environment settings uses same origin", () => {
  expect(resolveBackendUrl({ hostname: "localhost", origin: "http://localhost:4182" }, undefined)).toBe("http://localhost:4182");
});
test("native or development builds respect explicit backend and strip trailing slash", () => {
  expect(resolveBackendUrl({ hostname: "localhost", origin: "http://localhost" }, "https://bksistem.space/")).toBe("https://bksistem.space");
});
test("websocket endpoint follows API protocol", () => {
  expect(WS_API).toBe(API.replace(/^http/, "ws"));
});
