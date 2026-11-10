import { RuntimeRequestId } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";
import type { PendingApproval } from "../../session-logic";
import { approvalShortcutCommands } from "./approvalShortcuts";

const approval: PendingApproval = {
  requestId: RuntimeRequestId.make("oldest-approval"),
  requestKind: "command",
  createdAt: "2026-11-07T10:00:00Z",
  responseCapability: "live",
};
const context = (repeat = false) => ({
  event: { repeat } as KeyboardEvent,
  terminalFocusOwner: null,
});
const setup = (overrides: Partial<Parameters<typeof approvalShortcutCommands>[0]> = {}) => {
  const onRespondToApproval = vi.fn();
  const commands = approvalShortcutCommands({
    approval,
    heldRequestIds: new Set(),
    canOperateThread: true,
    respondingRequestIds: [],
    onRespondToApproval,
    ...overrides,
  });
  return { commands, onRespondToApproval };
};

describe("approval shortcuts", () => {
  it.each([
    ["approval.approve", "accept"],
    ["approval.decline", "decline"],
  ] as const)(
    "%s answers the shown approval once with %s, ignoring key repeats",
    (command, decision) => {
      const { commands, onRespondToApproval } = setup();
      commands[command]?.(context(true));
      commands[command]?.(context());
      expect(onRespondToApproval.mock.calls).toEqual([[approval.requestId, decision]]);
    },
  );

  it.each([
    { name: "no pending approval", approval: null },
    { name: "the approval held back while typing", heldRequestIds: new Set([approval.requestId]) },
    { name: "no operate permission", canOperateThread: false },
    {
      name: "the provider process gone",
      approval: { ...approval, responseCapability: "not_resumable" as const },
    },
    { name: "a response in flight", respondingRequestIds: [approval.requestId] },
  ])("lets the key through with $name", (overrides) => {
    const { commands, onRespondToApproval } = setup(overrides);
    expect(commands["approval.approve"]?.(context())).toBe(false);
    expect(commands["approval.decline"]?.(context())).toBe(false);
    expect(onRespondToApproval).not.toHaveBeenCalled();
  });

  it("never approves with a session-wide option in place of a one-time approval", () => {
    const { commands, onRespondToApproval } = setup({
      approval: {
        ...approval,
        options: [
          { decision: "acceptForSession", label: "Always allow" },
          { decision: "decline", label: "Decline" },
        ],
      },
    });
    expect(commands["approval.approve"]?.(context())).toBe(false);
    commands["approval.decline"]?.(context());
    expect(onRespondToApproval.mock.calls).toEqual([[approval.requestId, "decline"]]);
  });
});
