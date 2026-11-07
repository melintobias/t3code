import { RuntimeRequestId } from "@t3tools/contracts";
import { expect, it, vi } from "vite-plus/test";
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

it.each([
  ["approval.approve", "accept"],
  ["approval.decline", "decline"],
] as const)("%s answers only the displayed approval with %s", (command, decision) => {
  const onRespondToApproval = vi.fn().mockResolvedValue(undefined);
  const commands = approvalShortcutCommands({
    approval,
    canOperateThread: true,
    respondingRequestIds: [],
    onRespondToApproval,
  });
  commands[command]?.(context());
  expect(onRespondToApproval.mock.calls).toEqual([[approval.requestId, decision]]);
});

it.each([
  { name: "no pending approval", approval: null },
  { name: "no operate permission", canOperateThread: false },
  {
    name: "provider process gone",
    approval: { ...approval, responseCapability: "not_resumable" as const },
  },
  { name: "response in flight", respondingRequestIds: [approval.requestId] },
  {
    name: "neither decision offered",
    approval: { ...approval, options: [{ decision: "cancel" as const, label: "Cancel" }] },
  },
  { name: "no decisions offered", approval: { ...approval, options: [] } },
])("leaves both shortcuts inactive with $name", (overrides) => {
  const onRespondToApproval = vi.fn().mockResolvedValue(undefined);
  const commands = approvalShortcutCommands({
    approval,
    canOperateThread: true,
    respondingRequestIds: [],
    ...overrides,
    onRespondToApproval,
  });
  expect(commands["approval.approve"]?.(context())).toBe(false);
  expect(commands["approval.decline"]?.(context())).toBe(false);
  expect(onRespondToApproval).not.toHaveBeenCalled();
});

it("never substitutes session-wide acceptance for one-time approval", () => {
  const onRespondToApproval = vi.fn().mockResolvedValue(undefined);
  const commands = approvalShortcutCommands({
    approval: {
      ...approval,
      options: [
        { decision: "acceptForSession", label: "Always allow" },
        { decision: "decline", label: "Decline" },
      ],
    },
    canOperateThread: true,
    respondingRequestIds: [],
    onRespondToApproval,
  });
  expect(commands["approval.approve"]?.(context())).toBe(false);
  commands["approval.decline"]?.(context());
  expect(onRespondToApproval.mock.calls).toEqual([[approval.requestId, "decline"]]);
});

it("ignores held keys and a second decision before a response completes", async () => {
  let resolveResponse = () => {};
  const response = new Promise<void>((resolve) => {
    resolveResponse = resolve;
  });
  const onRespondToApproval = vi.fn(() => response);
  const input = { approval, canOperateThread: true, respondingRequestIds: [], onRespondToApproval };
  const commands = approvalShortcutCommands(input);
  commands["approval.approve"]?.(context(true));
  expect(onRespondToApproval).not.toHaveBeenCalled();
  commands["approval.approve"]?.(context());
  commands["approval.decline"]?.(context());
  expect(onRespondToApproval.mock.calls).toEqual([[approval.requestId, "accept"]]);
  resolveResponse();
  await response;

  const next = approvalShortcutCommands({
    ...input,
    approval: { ...approval, requestId: RuntimeRequestId.make("next-approval") },
  });
  next["approval.approve"]?.(context(true));
  expect(onRespondToApproval).toHaveBeenCalledOnce();
});
