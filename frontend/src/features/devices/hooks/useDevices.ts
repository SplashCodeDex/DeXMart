import { useCallback, useEffect } from "react";
import { useGateway } from "@/lib/gateway/gateway-hooks";
import type { DevicePairingList } from "@/types";
import { useDevicesStore } from "../store";

export function useDevices() {
  const { rpc, status } = useGateway();
  const { pending, paired, setDevices, setLoading, setError } = useDevicesStore();

  const fetchDevices = useCallback(async () => {
    if (status !== "connected" || !rpc) return;

    setLoading(true);
    try {
      const result = await rpc.call("device.pair.list", {});
      setDevices(result as DevicePairingList);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch devices";
      setError(message);
    }
  }, [rpc, status, setDevices, setLoading, setError]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Subscribe to device changes
  useEffect(() => {
    if (status !== "connected" || !rpc) return;

    // device.pair.list doesn't have a subscribe method in the matrix,
    // but typically there's an event. Let's check parity-matrix for events.
    // Actually, I'll just use a manual refresh for now or check if there's a generic device event.
  }, [rpc, status, fetchDevices]);

  const approve = async (requestId: string) => {
    if (!rpc) return false;
    try {
      await rpc.call("device.pair.approve", { requestId });
      await fetchDevices();
      return true;
    } catch (err) {
      console.error("Failed to approve device:", err);
      return false;
    }
  };

  const reject = async (requestId: string) => {
    if (!rpc) return false;
    try {
      await rpc.call("device.pair.reject", { requestId });
      await fetchDevices();
      return true;
    } catch (err) {
      console.error("Failed to reject device:", err);
      return false;
    }
  };

  const remove = async (deviceId: string) => {
    if (!rpc) return false;
    try {
      await rpc.call("device.pair.remove", { deviceId });
      await fetchDevices();
      return true;
    } catch (err) {
      console.error("Failed to remove device:", err);
      return false;
    }
  };

  const rotate = async (deviceId: string, role: string) => {
    if (!rpc) return null;
    try {
      const result = await rpc.call("device.token.rotate", { deviceId, role });
      await fetchDevices();
      return result;
    } catch (err) {
      console.error("Failed to rotate token:", err);
      return null;
    }
  };

  const revoke = async (deviceId: string, role: string) => {
    if (!rpc) return null;
    try {
      const result = await rpc.call("device.token.revoke", { deviceId, role });
      await fetchDevices();
      return result;
    } catch (err) {
      console.error("Failed to revoke token:", err);
      return null;
    }
  };

  return {
    pending,
    paired,
    isLoading: useDevicesStore((state) => state.isLoading),
    error: useDevicesStore((state) => state.error),
    refresh: fetchDevices,
    approve,
    reject,
    remove,
    rotate,
    revoke,
  };
}
