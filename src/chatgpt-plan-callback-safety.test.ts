import { afterEach, expect, test } from "bun:test";
import { ChatGptPlanError, parseChatGptCallback, startChatGptAuthorization } from "./chatgpt-plan.js";
import { createChatGptHostId } from "./chatgpt-plan.js";
import { startChatGptLoopback } from "./chatgpt-plan-loopback.js";

function pending(now?: number) {
  return startChatGptAuthorization({ agentName: "Orbi", hostId: createChatGptHostId(), port: 1455, ...(now === undefined ? {} : { now }) }).pending;
}

test("Given a callback error with hostile description, when parsed, then the message is fixed and carries no upstream text", () => {
  const attempt = pending(1_000);
  const url = new URL(attempt.redirectUri);
  url.searchParams.set("state", attempt.state);
  url.searchParams.set("error", "server_error");
  url.searchParams.set("error_description", "<script>alert(1)</script>");

  try {
    parseChatGptCallback(url.toString(), attempt, 1_000);
    throw new Error("Expected parse to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(ChatGptPlanError);
    const message = (error as ChatGptPlanError).message;
    expect(message).toBe("ChatGPT sign-in failed. Start again.");
    expect(message).not.toContain("<script>");
  }
});

test("Given a loopback callback with hostile text, when the failure page renders, then the body contains no unescaped script", async () => {
  let attempt = pending();
  const loopback = await startChatGptLoopback([0], () => attempt);
  try {
    attempt = startChatGptAuthorization({ agentName: "Orbi", hostId: attempt.hostId, port: loopback.port }).pending;
    const url = new URL(loopback.redirectUri);
    url.searchParams.set("state", attempt.state);
    url.searchParams.set("error", "server_error");
    url.searchParams.set("error_description", "<script>alert(1)</script>");
    const response = await fetch(url.toString());
    const body = await response.text();
    expect(response.status).toBe(400);
    expect(body).not.toContain("<script>");
    expect(body).toContain("ChatGPT sign-in failed. Start again.");
  } finally {
    await loopback.close();
  }
});
