import React, { act } from "react";
import { createRoot } from "react-dom/client";
import UnifiedLogin from "./UnifiedLogin";
import axios from "axios";
import { saveSession } from "../lib/auth";
const mockNavigate = jest.fn();
let mockReduced = false;
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }));
jest.mock("../App", () => ({ API: "/api" }));
jest.mock("axios");
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("../lib/auth", () => ({
  saveSession: jest.fn(), getRememberedUsername: () => "", clearSession: jest.fn(),
  ROLE_DEFAULT_ROUTE: { operator: "/operator" }, REMEMBER_USERNAME_KEY: "remember",
}));
jest.mock("framer-motion", () => {
  const React = require("react");
  const cache = {};
  return {
    useReducedMotion: () => mockReduced,
    AnimatePresence: ({ children }) => children,
    motion: new Proxy({}, { get: (_, tag) => cache[tag] || (cache[tag] = React.forwardRef(
      ({ initial, animate, exit, transition, whileTap, layoutId, ...props }, ref) => React.createElement(tag, { ...props, ref })
    )) }),
  };
});
let container, root;
const query = (id) => container.querySelector(`[data-testid="${id}"]`);
const render = async (props = {}) => act(async () => root.render(<UnifiedLogin {...props} />));
const change = (id, value) => act(() => {
  const input = query(id);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
const submit = async () => act(async () => { query("login-submit").closest("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
const fill = () => { change("login-username", "operator"); change("login-password", "secret"); };
const response = { data: { token: "test-token", role: "operator", username: "operator" } };
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers(); jest.clearAllMocks(); mockReduced = false;
  container = document.createElement("div"); document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); jest.useRealTimers(); });
test("empty submission focuses missing field and associates error", async () => {
  await render(); await submit();
  expect(document.activeElement).toBe(query("login-username"));
  expect(query("login-username").getAttribute("aria-describedby")).toBe("login-error");
  expect(axios.post).not.toHaveBeenCalled();
  change("login-username", "operator");
  expect(query("login-error")).toBeNull();
  expect(query("login-username").parentElement.dataset.filled).toBe("true");
});
test("password reveal is keyboard reachable and preserves value", async () => {
  await render(); fill();
  const toggle = query("login-toggle-password");
  expect(toggle.tabIndex).toBe(0);
  act(() => toggle.click());
  expect(query("login-password").type).toBe("text");
  expect(query("login-password").value).toBe("secret");
});
test("duplicate submits blocked; success precedes navigation", async () => {
  let resolve;
  axios.post.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const onAuthenticated = jest.fn();
  await render({ onAuthenticated }); fill(); await submit(); await submit();
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(query("login-submit").disabled).toBe(true);
  await act(async () => resolve(response));
  expect(saveSession).toHaveBeenCalledTimes(1);
  expect(query("login-submit").textContent).toContain("Giriş onaylandı");
  expect(mockNavigate).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(550));
  expect(mockNavigate).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(360));
  expect(mockNavigate).toHaveBeenCalledWith("/operator", { state: { loginDive: !mockReduced && query("unified-login")?.dataset.quiet !== "true" } });
  expect(onAuthenticated).toHaveBeenCalledTimes(1);
});
test.each([{ liteMode: true }, { reduced: true }])("quiet preference skips delay: %p", async (preference) => {
  mockReduced = !!preference.reduced;
  axios.post.mockResolvedValueOnce(response);
  await render({ liteMode: !!preference.liteMode }); fill(); await submit();
  expect(query("unified-login").dataset.quiet).toBe("true");
  act(() => jest.advanceTimersByTime(0));
  expect(mockNavigate).toHaveBeenCalledWith("/operator", { state: { loginDive: !mockReduced && query("unified-login")?.dataset.quiet !== "true" } });
});
test.each([401, 422, 423, 500])("HTTP %s allows retry", async (status) => {
  axios.post.mockRejectedValueOnce({ response: { status, data: { detail: "Tekrar deneyin" } } });
  axios.post.mockResolvedValueOnce(response);
  await render(); fill(); await submit();
  expect(query("login-error")).not.toBeNull();
  expect(query("login-submit").disabled).toBe(false);
  expect(query("login-password").value).toBe("secret");
  await submit();
  expect(query("login-submit").textContent).toContain("Giriş onaylandı");
});
test("unmount aborts pending request", async () => {
  axios.post.mockImplementationOnce(() => new Promise(() => {}));
  await render(); fill(); await submit();
  const signal = axios.post.mock.calls[0][2].signal;
  await act(async () => root.render(null));
  expect(signal.aborted).toBe(true);
});
test("unmount during success cancels navigation", async () => {
  axios.post.mockResolvedValueOnce(response);
  await render(); fill(); await submit();
  await act(async () => root.render(null));
  act(() => jest.runAllTimers());
  expect(mockNavigate).not.toHaveBeenCalled();
});
test("enabling lite mode during success completes immediately", async () => {
  axios.post.mockResolvedValueOnce(response);
  await render(); fill(); await submit();
  await render({ liteMode: true });
  act(() => jest.advanceTimersByTime(0));
  expect(mockNavigate).toHaveBeenCalledWith("/operator", { state: { loginDive: !mockReduced && query("unified-login")?.dataset.quiet !== "true" } });
});
test("parent callback changes do not restart confirmation", async () => {
  axios.post.mockResolvedValueOnce(response);
  await render(); fill(); await submit();
  act(() => jest.advanceTimersByTime(450));
  const latest = jest.fn();
  await render({ onAuthenticated: latest });
  act(() => jest.advanceTimersByTime(100));
  act(() => jest.advanceTimersByTime(360));
  expect(latest).toHaveBeenCalledTimes(1);
});

test("checking replaces fields and reports busy state; failure restores form", async () => {
  let reject;
  axios.post.mockImplementationOnce(() => new Promise((_, r) => { reject = r; }));
  const onBusyChange = jest.fn();
  await render({ onBusyChange }); fill(); await submit();
  expect(query("login-checking").textContent).toContain("Kontrol Ediliyor");
  expect(onBusyChange).toHaveBeenLastCalledWith(true);
  await act(async () => reject({ response: { status: 401 } }));
  expect(query("login-checking")).toBeNull();
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
  expect(query("login-password").value).toBe("secret");
});
