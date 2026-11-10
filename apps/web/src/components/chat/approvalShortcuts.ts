import type { ProviderApprovalDecision, RuntimeRequestId } from "@t3tools/contracts";
import type { PendingApproval } from "../../session-logic";
import type { ChatShortcutCommands } from "./useChatShortcuts";

export function approvalShortcutCommands(input: {
  readonly approval: PendingApproval | null;
  readonly heldRequestIds: ReadonlySet<string>;
  readonly canOperateThread: boolean;
  readonly respondingRequestIds: ReadonlyArray<RuntimeRequestId>;
  readonly onRespondToApproval: (
    requestId: RuntimeRequestId,
    decision: ProviderApprovalDecision,
  ) => Promise<unknown>;
}): ChatShortcutCommands {
  const respond =
    (decision: "accept" | "decline") =>
    ({ event }: { readonly event: KeyboardEvent }) => {
      const { approval } = input;
      if (
        !input.canOperateThread ||
        approval?.responseCapability !== "live" ||
        input.heldRequestIds.has(approval.requestId) ||
        input.respondingRequestIds.includes(approval.requestId) ||
        approval.options?.some((option) => option.decision === decision) === false
      )
        return false;
      if (!event.repeat) void input.onRespondToApproval(approval.requestId, decision);
    };
  return {
    "approval.approve": respond("accept"),
    "approval.decline": respond("decline"),
  };
}
