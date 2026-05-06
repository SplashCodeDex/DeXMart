"use client";

import { User, Mail, Shield, Camera, Loader2 } from "lucide-react";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/features/auth";
import { useAuthStore } from "@/features/auth/store";
import { api, API_ENDPOINTS } from "@/lib/api";

export function AccountSettings(): React.JSX.Element {
  const { user, isLoading } = useAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Sync form once the authenticated user is available
  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name cannot be empty");
      return;
    }
    setIsSaving(true);
    try {
      const response = await api.patch<{ name: string }>(API_ENDPOINTS.SETTINGS.PROFILE, {
        name: trimmed,
      });
      if (response.success) {
        // Optimistically update the auth store so the header/avatar reflects immediately
        if (user) {
          setUser({ ...user, name: response.data.name });
        }
        toast.success("Profile updated");
      } else {
        toast.error(response.error?.message ?? "Failed to update profile");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Account Settings</h2>
        <p className="text-muted-foreground text-sm">
          Manage your personal profile and security preferences.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Profile Picture
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <Avatar className="h-24 w-24 border-2 border-primary/20">
                <AvatarImage src={user?.photoURL || ""} alt={user?.name || ""} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                  {user?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <Button variant="outline" size="sm" className="w-full gap-2 rounded-xl">
                <Camera className="h-4 w-4" />
                Change Photo
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <User className="h-5 w-5 text-primary" />
                Personal Information
              </CardTitle>
              <CardDescription>Update your public identity on DeXMart.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background/50 rounded-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    defaultValue={user?.email || ""}
                    className="bg-muted rounded-xl"
                    disabled
                  />
                  <Button variant="outline" size="icon" className="shrink-0 rounded-xl">
                    <Mail className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Email changes require re-verification.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Shield className="h-5 w-5 text-primary" />
                Security
              </CardTitle>
              <CardDescription>Manage your password and authentication methods.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Password</p>
                  <p className="text-xs text-muted-foreground">Update your account password.</p>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl">
                  Change Password
                </Button>
              </div>
              <Separator className="bg-border/50" />
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Two-Factor Authentication</p>
                  <p className="text-xs text-muted-foreground text-error italic text-yellow-500">
                    Not enabled yet
                  </p>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl">
                  Enable 2FA
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
              className="rounded-xl px-8 shadow-lg ring-1 ring-primary/20"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Profile
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
