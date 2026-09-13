import React, { act } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import WarehouseSummaryCard from "./WarehouseSummaryCard";
jest.mock("axios");
jest.mock("../App", () => ({ API: "https://bksistem.space/api" }));
let root, container;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  container = document.createElement("div"); document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
test("uses shared API and retries a failed summary request", async () => {
  axios.get.mockRejectedValueOnce(new Error("network"));
  axios.get.mockResolvedValueOnce({data:{ DEPO1:{bobin_count:2,marka_stok_count:3,bobin_critical:0,marka_stok_critical:0} }});
  await act(async () => root.render(<WarehouseSummaryCard compact />));
  expect(axios.get.mock.calls[0][0]).toBe("https://bksistem.space/api/warehouse-summary");
  expect(container.querySelector('[data-testid="wh-summary-error"]')).not.toBeNull();
  await act(async () => container.querySelector('[data-testid="wh-summary-retry"]').click());
  expect(container.querySelector('[data-testid="wh-summary-error"]')).toBeNull();
  expect(container.querySelector('[data-testid="wh-summary-compact-DEPO1"]').textContent).toContain("5");
});
