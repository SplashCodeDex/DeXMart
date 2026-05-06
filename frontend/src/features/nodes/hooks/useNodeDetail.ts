import type {
  NodeDescribeParams,
  NodeInvokeParams,
  NodeRenameParams,
} from "@openclaw/protocol/index";
import { useRpcCall } from "@/lib/gateway/gateway-hooks";

export function useNodeDetail(nodeId: string) {
  const describeRpc = useRpcCall("node.describe");
  const invokeRpc = useRpcCall("node.invoke");
  const renameRpc = useRpcCall("node.rename");

  const describe = async () => {
    return await describeRpc({ nodeId });
  };

  const invoke = async (command: string, params: any = {}, timeoutMs?: number) => {
    // Generate an idempotency key for the invocation
    // In a browser environment, crypto.randomUUID() is widely available.
    const idempotencyKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2) + Date.now().toString(36);

    return await invokeRpc({ nodeId, command, params, timeoutMs, idempotencyKey });
  };

  const rename = async (displayName: string) => {
    return await renameRpc({ nodeId, displayName });
  };

  return {
    describe,
    invoke,
    rename,
  };
}
