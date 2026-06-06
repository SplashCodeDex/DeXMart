'use client';

import { Rocket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { type JSX } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

function UpgradeModal({
  isOpen,
  onClose,
  title = "Upgrade to Pro",
  description = "You've reached the limit of your current plan. Upgrade to unlock more bots and features."
}: UpgradeModalProps): JSX.Element {
  const router = useRouter();

  const handleUpgrade = (): void => {
    router.push('/dashboard/billing');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Rocket size={24} />
          </div>
          <DialogTitle className="text-center text-xl">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Button onClick={handleUpgrade} size="lg" className="w-full font-semibold">
              View Plans & Upgrade
            </Button>
            <Button variant="ghost" onClick={onClose} className="w-full">
              Maybe Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
