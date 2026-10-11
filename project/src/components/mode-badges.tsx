import { Sparkles, Zap, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AiModeBadge({ mode = 'demo' }: { mode?: 'demo' | 'live' }) {
  if (mode === 'demo') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200">
        <Sparkles className="h-3 w-3" />
        AI Demo Mode
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
      <Zap className="h-3 w-3" />
      AI Live Mode
    </span>
  );
}

export function PaymentModeBadge({ mode = 'demo' }: { mode?: 'demo' | 'devnet' }) {
  if (mode === 'demo') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200">
        <WifiOff className="h-3 w-3" />
        Payment Demo Mode
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700 border border-indigo-200">
      <Wifi className="h-3 w-3" />
      Solana Devnet
    </span>
  );
}

export function ModeBadge({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <AiModeBadge mode="demo" />
      <PaymentModeBadge mode="demo" />
    </div>
  );
}
