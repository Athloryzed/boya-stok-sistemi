import React, { act } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import SampleApproval, { remainingSeconds } from "./SampleApproval";
jest.mock("axios");
jest.mock("./ui/button", () => ({ Button: ({ children, variant, ...props }) => <button {...props}>{children}</button> }));
jest.mock("./ui/input", () => ({ Input: require("react").forwardRef((props, ref) => <input ref={ref} {...props} />) }));
jest.mock("../App", () => ({ API: "https://bksistem.space/api" }));
let root, container, state;
const at = "2026-09-13T10:00:00.000Z";
const makeSample = (overrides = {}) => ({ revision: "v1", status: "awaiting_view", note: "Renk kontrolü", created_at: at, deadline: null, strict: false, events: [], history: [], ...overrides });
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers(); jest.setSystemTime(Date.parse(at)); jest.clearAllMocks();
  URL.createObjectURL = jest.fn(() => "blob:photo"); URL.revokeObjectURL = jest.fn();
  state = { server_time: at, sample: makeSample() };
  axios.get.mockImplementation(async url => ({ data: url.endsWith("/image") ? new Blob(["photo"]) : state }));
  axios.post.mockImplementation(async () => { state = { ...state, sample: { ...state.sample, status: "pending", deadline: "2026-09-13T10:10:00.000Z" } }; return { data: state }; });
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); jest.useRealTimers(); });
const render = async () => act(async () => root.render(<SampleApproval token="secret" />));
const loadPhoto = async () => act(async () => container.querySelector("img").dispatchEvent(new Event("load")));
test("does not start timer until photo loads, then records the viewed revision", async () => {
  await render();
  expect(axios.post).not.toHaveBeenCalled();
  await loadPhoto();
  expect(axios.post.mock.calls[0][0]).toBe("https://bksistem.space/api/takip/secret/sample/v1/view");
  expect(container.textContent).toContain("10:00");
});
test("failed image never starts approval deadline", async () => {
  axios.get.mockImplementation(async url => { if (url.endsWith("/image")) throw Error("offline"); return {data: state}; });
  await render();
  expect(container.textContent).toContain("Fotoğraf yüklenemedi");
  expect(axios.post).not.toHaveBeenCalled();
});
test("server clock offset controls countdown and clamps expired time", () => {
  expect(remainingSeconds("2026-09-13T10:10:00Z", Date.parse(at))).toBe(600);
  expect(remainingSeconds(at, Date.parse(at) + 1000)).toBe(0);
  expect(remainingSeconds(null, Date.parse(at))).toBeNull();
});
test("strict sample has no countdown, requires name and correction text", async () => {
  state.sample = makeSample({ status: "pending", strict: true });
  await render(); await loadPhoto();
  expect(container.querySelector('[aria-label="Kalan yanıt süresi"]')).toBeNull();
  const buttons = [...container.querySelectorAll("button")];
  expect(buttons.find(b => b.textContent === "Onaylıyorum").disabled).toBe(true);
  expect(buttons.find(b => b.textContent === "Düzeltme istiyorum").disabled).toBe(true);
  expect(container.textContent).toContain("açık müşteri onayı zorunludur");
});
test("expired state never offers approval and is not labelled customer approved", async () => {
  state.sample = makeSample({ status: "expired" });
  await render();
  expect(container.textContent).toContain("Yanıt süresi doldu");
  expect(container.textContent).not.toContain("Müşteri onayladı");
  expect([...container.querySelectorAll("button")].find(b => b.textContent === "Onaylıyorum")).toBeUndefined();
});
test("replacement fetches new photo and does not mark it viewed before load", async () => {
  state.sample = makeSample({ status: "approved" });
  await render(); await loadPhoto();
  state = { ...state, sample: makeSample({ revision: "v2" }) };
  await act(async () => jest.advanceTimersByTime(5000));
  expect(axios.get.mock.calls.some(([url]) => url.endsWith("/v2/image"))).toBe(true);
  expect(axios.post).not.toHaveBeenCalled();
  await loadPhoto();
  expect(axios.post.mock.calls[0][0]).toContain("/v2/view");
});
