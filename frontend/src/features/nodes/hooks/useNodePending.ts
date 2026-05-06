import type {
  NodePendingAckParams,
  NodePendingDrainParams,
  NodePendingEnqueueParams,
} from "@openclaw/protocol/index";
import { useRpcCall } from "@/lib/gateway/gateway-hooks";

export function useNodePending(nodeId: string) {
  const pullRpc = useRpcCall("node.pending.pull");
  const ackRpc = useRpcCall("node.pending.ack");
  const drainRpc = useRpcCall("node.pending.drain");
  const enqueueRpc = useRpcCall("node.pending.enqueue");

  const pull = async () => {
    // Note: node.pending.pull is usually called by the node itself to get its own work.
    // Dashboard usage depends on the client identity having a valid nodeId mapping.
    return await pullRpc({});
  };

  const ack = async (ids: string[]) => {
    return await ackRpc({ ids });
  };

  const drain = async (params: NodePendingDrainParams = {}) => {
    return await drainRpc(params);
  };

  const enqueue = async (params: Omit<NodePendingEnqueueParams, "nodeId">) => {
    return await enqueueRpc({ ...params, nodeId });
  };

  return {
    pull,
    ack,
    drain,
    enqueue,
  };
}
