import type { ExecApprovalsSnapshot, ExecApprovalsSetParams } from "@openclaw/protocol";
import { useRpcCall } from "@/lib/gateway/gateway-hooks";

export function useExecApprovals() {
  const getRpc = useRpcCall("exec.approvals.get");
  const setRpc = useRpcCall("exec.approvals.set");

  const listRpc = useRpcCall("exec.approval.list");

  const getSnapshot = async () => {
    return (await getRpc({})) as ExecApprovalsSnapshot;
  };

  const listPending = async () => {
    return await listRpc({});
  };

  const setApprovals = async (params: ExecApprovalsSetParams) => {
    return await setRpc(params);
  };

  return {
    getSnapshot,
    listPending,
    setApprovals,
  };
}
