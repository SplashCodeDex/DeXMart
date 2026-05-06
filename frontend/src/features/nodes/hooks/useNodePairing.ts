import type { PairingList } from "@openclaw/protocol";
import { useRpcCall } from "@/lib/gateway/gateway-hooks";

export function useNodePairing() {
  const listRpc = useRpcCall("node.pair.list");
  const approveRpc = useRpcCall("node.pair.approve");
  const rejectRpc = useRpcCall("node.pair.reject");

  const list = async () => {
    return (await listRpc({})) as PairingList;
  };

  const approve = async (requestId: string) => {
    return await approveRpc({ requestId });
  };

  const reject = async (requestId: string) => {
    return await rejectRpc({ requestId });
  };

  return {
    list,
    approve,
    reject,
  };
}
