"use client";

import { format } from "date-fns";
import {
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  XCircle,
  Power,
  MoreVertical,
  RotateCw,
  Trash2,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDevices } from "../hooks/useDevices";

export function DevicePairingTable() {
  const { pending, paired, isLoading, approve, reject, remove, rotate, revoke } = useDevices();

  const handleApprove = async (id: string) => {
    const success = await approve(id);
    if (success) toast.success("Device authorized");
  };

  const handleReject = async (id: string) => {
    const success = await reject(id);
    if (success) toast.success("Pairing request rejected");
  };

  const handleRemove = async (id: string) => {
    const success = await remove(id);
    if (success) toast.success("Device removed");
  };

  const handleRotate = async (id: string) => {
    const success = await rotate(id);
    if (success) toast.success("Token rotated");
  };

  const handleRevoke = async (id: string) => {
    const success = await revoke(id);
    if (success) toast.success("Token revoked");
  };

  return (
    <div className="space-y-8">
      {/* Pending Pairing Requests */}
      {pending.length > 0 && (
        <Card className="border-orange-500/50 bg-card/60 backdrop-blur-sm border-border/50 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-orange-500 flex items-center text-xl font-black italic tracking-tighter">
                <ShieldAlert className="mr-2 h-6 w-6" />
                PENDING AUTHORIZATION
              </CardTitle>
              <CardDescription className="text-orange-500/70 font-medium">
                New hardware requesting access to the gateway.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((device) => (
                  <TableRow key={device.requestId}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Smartphone className="h-4 w-4 text-orange-500" />
                        <div>
                          <div className="font-medium">{device.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {device.deviceId}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-orange-500 border-orange-500/20 bg-orange-500/10"
                      >
                        {device.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {format(new Date(device.requestedAt), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleReject(device.requestId)}
                        >
                          Deny
                        </Button>
                        <Button
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600"
                          onClick={() => handleApprove(device.requestId)}
                        >
                          Authorize
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Authorized Devices */}
      <Card className="bg-card/60 backdrop-blur-sm border border-border/50 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center text-lg font-bold">
            <ShieldCheck className="mr-2 h-5 w-5 text-green-500" />
            Authorized Hardware
          </CardTitle>
          <CardDescription>Verified physical endpoints with active clearances.</CardDescription>
        </CardHeader>
        <CardContent>
          {paired.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground italic text-sm border border-dashed rounded-xl">
              No authorized hardware found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Established</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead className="text-right">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paired.map((device) => (
                  <TableRow key={device.deviceId}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{device.name || "Personal Proxy"}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {device.deviceId}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="bg-green-500/10 text-green-500 border-green-500/20"
                      >
                        {device.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {format(new Date(device.pairedAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {device.lastSeenAt
                        ? format(new Date(device.lastSeenAt), "MMM d, HH:mm")
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove Permanently
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Authorized Device?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently sever the linkage for{" "}
                                  <strong>{device.name || device.deviceId}</strong>. The hardware
                                  will no longer be able to authenticate until re-paired.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive hover:bg-destructive/90"
                                  onClick={() => handleRemove(device.deviceId)}
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
