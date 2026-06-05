'use client';

import { Slack, ShieldCheck, Loader2, MessageSquare, Hash, QrCode, KeyRound, UserCircle2, Users, Network } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { SiWhatsapp, SiTelegram, SiDiscord, SiSignal, SiGooglechat } from 'react-icons/si';
import { toast } from 'sonner';

import { FormError } from '@/components/ui/form-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { api } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/api/endpoints';
import { cn } from '@/lib/utils';
import { useOmnichannelStore } from '@/stores/useOmnichannelStore';

type IconComponent = React.ComponentType<{ className?: string }>;
const ICON_MAP: Record<string, IconComponent> = {
  SiWhatsapp,
  SiTelegram,
  SiDiscord,
  Slack,
  SiSignal,
  MessageSquare,
  Hash,
  SiGooglechat,
  SiMicrosoftteams: Users,
  SiMatrix: Network
};

interface ChannelConnectionFormProps {
  type: string;
  agentId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ChannelConnectionForm({ type, agentId: initialAgentId, onSuccess, onCancel }: ChannelConnectionFormProps): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [connectionMethod, setConnectionMethod] = useState<'qr' | 'pairing'>('qr');
  const [selectedAgentId, setSelectedAgentId] = useState(initialAgentId || 'system_default');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validatePhoneNumber = (phone: string): boolean => {
    // E.164 format: + followed by up to 15 digits
    const e164Pattern = /^\+[1-9]\d{1,14}$/;
    return e164Pattern.test(phone);
  };

  const validateField = (fieldId: string, value: string, type?: 'text' | 'password' | 'number'): string | null => {
    if (!value) {
      return 'This field is required';
    }
    if (type === 'number') {
      if (!/^\d+$/.test(value)) {
        return 'Must be a number';
      }
    }
    // Add more type validations as needed
    return null;
  };

  const validateForm = (): boolean => {
    const newFieldErrors: Record<string, string> = {};
    let hasError = false;

    // Validate platform fields
    if (platform && platform.fields.length > 0) {
      platform.fields.forEach((field) => {
        const value = credentials[field.id] || '';
        const error = validateField(field.id, value, field.type);
        if (error) {
          newFieldErrors[field.id] = error;
          hasError = true;
        }
      });
    }

    // Validate phone number for WhatsApp pairing method
    if (type === 'whatsapp' && connectionMethod === 'pairing') {
      const phoneValue = credentials.phone || '';
      if (!validatePhoneNumber(phoneValue)) {
        newFieldErrors.phone = 'Please enter a valid phone number in E.164 format (e.g., +1234567890)';
        hasError = true;
      }
    }

    setFieldErrors(newFieldErrors);
    return !hasError;
  };
  const { fetchAllChannels, fetchAgents, platforms, agentsResult } = useOmnichannelStore();

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const agents = agentsResult?.agents || [];

  const platform = platforms.find(p => p.id === type);

  if (!platform) {
    return (
      <Card className="w-full max-w-md shadow-lg border-primary/10 bg-card text-foreground overflow-hidden">
        <CardContent className="pt-6 text-center">
          <p>Loading platform configuration...</p>
          <Button variant="ghost" onClick={onCancel} className="mt-4">Cancel</Button>
        </CardContent>
      </Card>
    );
  }

  const Icon = ICON_MAP[platform.icon] || MessageSquare;
  const iconColorClass = platform.color.replace('bg-', 'text-');

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    // Validate form
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      const payload: {
        type: string;
        name: string;
        credentials: Record<string, string>;
        config: Record<string, unknown>;
        metadata?: { connectionMethod: string };
        phoneNumber?: string;
      } = {
        type,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} Channel`,
        credentials: { ...credentials },
        config: {}
      };

      // Add connection method for WhatsApp
      if (type === 'whatsapp') {
        payload.metadata = { connectionMethod };
        if (connectionMethod === 'pairing' && credentials.phone) {
          payload.phoneNumber = credentials.phone;
        }
        if (credentials.deviceName) {
          payload.config.deviceName = credentials.deviceName;
          delete payload.credentials.deviceName;
        }
      }

      const response = await api.post(API_ENDPOINTS.OMNICHANNEL.AGENTS.CHANNELS.CREATE(selectedAgentId), payload);

      if (response.success) {
        toast.success(`Connection initiated for ${type}. Check the hub for status.`);
        await fetchAllChannels();
        onSuccess?.();
      } else {
        const errorMsg = response.error.message || 'Failed to connect channel';
        setSubmitError(errorMsg);
        toast.error(errorMsg);
      }
    } catch {
      setSubmitError('An unexpected connection error occurred. Please check your network.');
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-lg border-primary/10 bg-card text-foreground overflow-hidden">
      <CardHeader className="bg-muted/30 pb-6 border-b border-border/50">
        <div className="flex items-center space-x-3 mb-2">
          <div className={cn("p-2 rounded-lg bg-background border border-border/50 shadow-sm")}>
            <Icon className={cn("h-6 w-6", iconColorClass)} />
          </div>
          <div>
            <CardTitle className="text-xl">Connect {platform.label}</CardTitle>
            <CardDescription className="text-xs">{platform.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6 pt-6">
          <FormError message={submitError || undefined} />

          {/* Agent Assignment */}
          <div className="space-y-4">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-2">
              <UserCircle2 className="h-3 w-3" />
              Assign to Agent
            </Label>
            <div className="space-y-2">
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="bg-background/50 border-border/50 h-9">
                  <SelectValue placeholder="Select Agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system_default">System Default Agent</SelectItem>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name ?? agent.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground italic">
                Incoming messages will be immediately routed to this agent's AI logic.
              </p>
            </div>
          </div>

          {/* WhatsApp Specific Connection Method */}
          {type === 'whatsapp' && (
            <div className="space-y-4 pt-4 border-t border-border/50">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-2">
                <ShieldCheck className="h-3 w-3" />
                Connection Method
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConnectionMethod('qr')}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-2",
                    connectionMethod === 'qr'
                      ? "bg-primary/10 border-primary text-primary shadow-sm"
                      : "bg-background border-border/50 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <QrCode className="h-5 w-5" />
                  <span className="text-[10px] font-bold">QR Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConnectionMethod('pairing')}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-2",
                    connectionMethod === 'pairing'
                      ? "bg-primary/10 border-primary text-primary shadow-sm"
                      : "bg-background border-border/50 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <KeyRound className="h-5 w-5" />
                  <span className="text-[10px] font-bold">Pairing Code</span>
                </button>
              </div>

              {connectionMethod === 'pairing' && (
                <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Label htmlFor="phone" className="text-xs">Phone Number</Label>
              <Input
                id="phone"
                placeholder="+1234567890"
                value={credentials.phone || ''}
                onChange={(e) => {
                  setCredentials({ ...credentials, phone: e.target.value });
                  // Clear error as user types
                  if (phoneError) setPhoneError(null);
                }}
                required
                className="bg-background/50 border-border/50 h-9"
                aria-invalid={!!phoneError}
                aria-describedby={phoneError ? "phone-error" : undefined}
              />
              {!!phoneError && (
                <p id="phone-error" className="text-destructive text-xs mt-1">
                  {phoneError}
                </p>
              )}
                  <p className="text-[10px] text-muted-foreground italic">
                    Include country code (e.g. +1). You will receive a code on your mobile device.
                  </p>
                </div>
              )}
            </div>
          )}

           {platform.fields.length > 0 && (
             <div className="space-y-4 pt-4 border-t border-border/50">
               {platform.fields.map((field) => (
                 <div key={field.id} className="space-y-2">
                   <Label htmlFor={field.id} className="text-xs">{field.label}</Label>
                   <Input
                     id={field.id}
                     placeholder={field.placeholder}
                     value={credentials[field.id] || ''}
                     onChange={(e) => {
                       setCredentials({ ...credentials, [field.id]: e.target.value });
                       // Clear field error as user types
                       if (fieldErrors[field.id]) {
                         const newErrors = { ...fieldErrors };
                         delete newErrors[field.id];
                         setFieldErrors(newErrors);
                       }
                     }}
                     required
                     className="bg-background/50 border-border/50 h-9"
                     aria-invalid={!!fieldErrors[field.id]}
                     aria-describedby={fieldErrors[field.id] ? `${field.id}-error` : undefined}
                   />
                   {!!fieldErrors[field.id] && (
                     <p id={`${field.id}-error`} className="text-destructive text-xs mt-1">
                       {fieldErrors[field.id]}
                     </p>
                   )}
                 </div>
               ))}
             </div>
           )}
        </CardContent>
        <CardFooter className="flex justify-between bg-muted/20 border-t border-border/50 py-4">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={loading} className="font-bold">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Connect Channel
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
