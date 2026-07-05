import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { activateLicense } from '@/services/shops';
import { isWellFormedKey } from '@/lib/licenseUtils';
import { ShieldCheck, KeyRound, LogOut, AlertTriangle, Loader2 } from 'lucide-react';

export default function LicensePage() {
  const { shop, profile, signOut, refreshShop } = useAuth();
  const [key, setKey]         = useState('');
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    const trimmed = key.trim().toLowerCase();
    if (!isWellFormedKey(trimmed)) {
      toast.error('License key format වැරදියි. xxxxxxxx-xxxxxxxx-xxxxxxxx ආකෘතිය භාවිත කරන්න.');
      return;
    }
    if (!shop) { toast.error('Shop data හමු නොවිය'); return; }

    setLoading(true);
    try {
      await activateLicense(shop.id, trimmed);
      toast.success('License සාර්ථකව activate විය! 🎉');
      await refreshShop();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Activation දෝෂය');
    } finally {
      setLoading(false);
    }
  };

  // Auto-format input as user types: insert dashes at positions 8 and 17
  const handleKeyInput = (val: string) => {
    const raw = val.replace(/-/g, '').replace(/[^0-9a-fA-F]/g, '').slice(0, 24);
    let formatted = raw;
    if (raw.length > 8)  formatted = raw.slice(0, 8)  + '-' + raw.slice(8);
    if (raw.length > 16) formatted = raw.slice(0, 8)  + '-' + raw.slice(8, 16) + '-' + raw.slice(16);
    setKey(formatted);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Brand header */}
      <div className="mb-8 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-1">
          <ShieldCheck className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold text-balance">POShitha Pro</h1>
        </div>
        <p className="text-muted-foreground text-sm text-pretty">License Activation</p>
      </div>

      {/* Alert card */}
      <Card className="w-full max-w-md mb-4 border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20">
        <CardContent className="pt-4 pb-4 flex gap-3 items-start">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300 text-pretty">
            ඔබගේ කඩය සඳහා license key activate කර නොමැත. system භාවිතා කිරීමට
            valid license key ඇතුළත් කරන්න.
          </p>
        </CardContent>
      </Card>

      {/* Activation form */}
      <Card className="w-full max-w-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            License Key ඇතුළු කරන්න
          </CardTitle>
          <CardDescription>
            ඔබේ software license key ඇතුළු කරන්න
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Shop info */}
          {shop && (
            <div className="rounded-lg bg-muted/40 px-3 py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">කඩය</p>
                <p className="text-sm font-semibold truncate">{shop.name}</p>
              </div>
              <Badge variant="outline" className="shrink-0 text-xs">{shop.id.slice(0, 8)}…</Badge>
            </div>
          )}

          {/* Key input */}
          <div className="space-y-1.5">
            <Label className="text-sm font-normal">License Key</Label>
            <Input
              placeholder="xxxxxxxx-xxxxxxxx-xxxxxxxx"
              value={key}
              onChange={e => handleKeyInput(e.target.value)}
              className="px-3 font-mono tracking-wider text-sm"
              maxLength={26}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Format: 8-8-8 hex characters (lowercase/uppercase OK)
            </p>
          </div>

          {/* Activate button */}
          <Button
            onClick={handleActivate}
            disabled={loading || key.length < 26}
            className="w-full gap-2"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Activating…</>
              : <><ShieldCheck className="w-4 h-4" /> License Activate කරන්න</>
            }
          </Button>

          {/* Help text */}
          <p className="text-xs text-muted-foreground text-pretty text-center">
            License key නොමැතිනම් ඔබේ software supplier හමු වන්න.
          </p>
        </CardContent>
      </Card>

      {/* Sign-out link */}
      <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <span>ලොගින් වී ඇත: <strong>{profile?.username}</strong></span>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="gap-1 h-7 px-2 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-3.5 h-3.5" />
          ඉවත් වන්න
        </Button>
      </div>
    </div>
  );
}
