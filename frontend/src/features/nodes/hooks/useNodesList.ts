import type { NodeListParams } from "@openclaw/protocol/index";
import { useRpcCall } from "@/lib/gateway/gateway-hooks";

export function useNodesList() {
  const listRpc = useRpcCall("node.list");

  const listNodes = async (params: NodeListParams = {}) => {
    const res = await listRpc(params);
    return res.nodes;
  };

  return {
    listNodes,
  };
}
