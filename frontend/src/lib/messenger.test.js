import axios from "axios";
import { chatApi } from "./messenger";
jest.mock("axios");
jest.mock("./api", () => ({ API: "https://bksistem.space/api" }));
beforeEach(() => jest.clearAllMocks());
test("conversation requests use the shared application origin", async () => {
  axios.get.mockResolvedValue({ data: [{ id: "one" }] });
  expect(await chatApi.listConversations()).toEqual([{ id: "one" }]);
  expect(axios.get.mock.calls[0][0]).toBe("https://bksistem.space/api/chat/conversations");
});
test.each([{}, "<html>redirect</html>", null, [null]])("rejects malformed conversation data before it can enter UI state: %p", async data => {
  axios.get.mockResolvedValue({ data });
  await expect(chatApi.listConversations()).rejects.toThrow("geçersiz liste");
});
test.each(["listUsers", "getTemplates", "listMessages"])("validates %s list responses too", async method => {
  axios.get.mockResolvedValue({ data: { detail: "unexpected response" } });
  await expect(chatApi[method]("one")).rejects.toThrow("geçersiz liste");
});
