import { AI_THREAD_TYPES, ASSISTANT_MESSAGE_ROLES, ASSISTANT_MESSAGE_STATUSES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import {
  AI_CONVERSATION,
  AI_CONVERSATION_EVALUATION,
  AI_CONVERSATION_MESSAGES,
  AI_CONVERSATION_THREAD_ID,
} from "../../data/ai-conversations/ai-conversations.data";
import { AI_CONVERSATIONS_HANDLES as HANDLES } from "../../data/ai-conversations/handles";
import { AI_MENTOR_PRACTICE_HANDLES } from "../../data/ai-mentor-practice/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { mockAiConversationsFlow } from "../../flows/ai-conversations/mock-ai-conversations.flow";

// UI-contract suite: saved AI threads can only be produced by LLM conversations, so the
// admin history API is mocked through the domain mock flow (strategy §9).

test("admin browses paginated saved history and evaluation without conversation mutations", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { mutations } = await mockAiConversationsFlow(page);
    await page.goto("/admin/ai-conversations?status=archived&search=Historical&page=2");
    await expect(page.getByTestId(HANDLES.row(AI_CONVERSATION_THREAD_ID))).toBeVisible();
    // The history list shows no learner avatars.
    await expect(page.getByTestId(HANDLES.LIST).getByRole("img")).toHaveCount(0);
    await page.getByTestId(HANDLES.row(AI_CONVERSATION_THREAD_ID)).click();
    await expect(page).toHaveURL(
      new RegExp(`${AI_CONVERSATION_THREAD_ID}\\?status=archived&search=Historical&page=2`),
    );
    await expect(page.getByTestId(HANDLES.MESSAGE)).toContainText(
      AI_CONVERSATION_MESSAGES.learnerAnswer,
    );
    await expect(page.getByTestId(HANDLES.LIST)).toBeVisible();
    await expect(page.getByTestId(HANDLES.row(AI_CONVERSATION_THREAD_ID))).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.getByTestId(HANDLES.LOAD_MORE).click();
    await expect(page.getByTestId(HANDLES.MESSAGE)).toHaveCount(2);
    await expect(page.getByTestId(HANDLES.MESSAGE).nth(1)).toContainText(
      AI_CONVERSATION_MESSAGES.mentorFeedback,
    );
    await page.getByTestId(HANDLES.DETAILS_TAB).click();
    await expect(page.getByTestId(HANDLES.DETAILS_PANEL)).toBeVisible();
    const score = String(AI_CONVERSATION_EVALUATION.score);
    await expect(page.getByTestId(HANDLES.SCORE)).toHaveText(score);
    await page.getByTestId(HANDLES.RESULT).click();
    // The dialog comes from @mentingo/voice, which exposes no handle on the score itself.
    await expect(page.getByTestId(AI_MENTOR_PRACTICE_HANDLES.FEEDBACK_DIALOG)).toContainText(score);
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId(HANDLES.LIST)).toBeHidden();
    await page.getByTestId(HANDLES.BACK).click();
    await expect(page).toHaveURL(/ai-conversations\?status=archived&search=Historical&page=2$/);
    await expect(page.getByTestId(HANDLES.LIST)).toBeVisible();
    await page.getByTestId(HANDLES.SEARCH).fill("Another title");
    await expect(page).not.toHaveURL(/page=2/);
    await expect(page).not.toHaveURL(new RegExp(AI_CONVERSATION_THREAD_ID));
    expect(mutations).toEqual([]);
  });
});

test("admin sees an unavailable transcript and can return to the list", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await mockAiConversationsFlow(page, { thread: null });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/admin/ai-conversations/${AI_CONVERSATION_THREAD_ID}`);
    await expect(page.getByTestId(HANDLES.READER).getByRole("alert")).toBeVisible();
    await page.getByTestId(HANDLES.BACK).click();
    await expect(page.getByTestId(HANDLES.row(AI_CONVERSATION_THREAD_ID))).toBeVisible();
  });
});

test("admin Assistant history never requests model-provided images or links", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { blockedRequests } = await mockAiConversationsFlow(page, {
      blockedHost: "attacker.invalid",
      thread: { type: AI_THREAD_TYPES.ASSISTANT, evaluation: null },
      messages: [
        {
          id: "mock-model-response",
          role: ASSISTANT_MESSAGE_ROLES.ASSISTANT,
          status: ASSISTANT_MESSAGE_STATUSES.COMPLETE,
          content:
            "Saved Assistant answer.\n\n![preview][p]\n\n[p]: //attacker.invalid/pixel\n\n[unverified][x]\n\n[x]: //attacker.invalid/landing",
          createdAt: AI_CONVERSATION.lastActivityAt,
        },
      ],
    });
    await page.goto(`/admin/ai-conversations/${AI_CONVERSATION_THREAD_ID}`);
    const message = page.getByTestId(HANDLES.MESSAGE);
    await expect(message).toContainText("Saved Assistant answer.");
    await expect(message).toContainText("preview");
    // innerHTML always serializes attributes with double quotes; the URL may survive only as plain text.
    expect(await message.evaluate((element) => element.innerHTML)).not.toMatch(
      /\b(?:src|href|srcset|style)="[^"]*attacker\.invalid/,
    );
    expect(blockedRequests).toEqual([]);
  });
});
