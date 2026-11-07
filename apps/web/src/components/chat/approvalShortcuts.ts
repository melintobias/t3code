import type { ProviderApprovalDecision, RuntimeRequestId } from "@t3tools/contracts";
import type { PendingApproval } from "../../session-logic";
import type { ChatShortcutCommands } from "./useChatShortcuts";

export function approvalShortcutCommands(input: {
  readonly approval: PendingApproval | null;
  readonly canOperateThread: boolean;
  readonly respondingRequestIds: ReadonlyArray<RuntimeRequestId>;
  readonly onRespondToApproval: (
    requestId: RuntimeRequestId,
    decision: ProviderApprovalDecision,
  ) => Promise<unknown>;
}): ChatShortcutCommands {
  let responsePending = false;
  const respond = (decision: "accept" | "decline", event: KeyboardEvent) => {
    const { approval } = input;
    if (
      !input.canOperateThread ||
      !approval ||
      approval.responseCapability !== "live" ||
      input.respondingRequestIds.includes(approval.requestId) ||
      (approval.options !== undefined &&
        !approval.options.some((option) => option.decision === decision))
    )
      return false;
    if (event.repeat || responsePending) return;
    responsePending = true;
    void input.onRespondToApproval(approval.requestId, decision).finally(() => {
      responsePending = false;
    });
  };
  return {
    "approval.approve": ({ event }) => respond("accept", event),
    "approval.decline": ({ event }) => respond("decline", event),
  };
}
