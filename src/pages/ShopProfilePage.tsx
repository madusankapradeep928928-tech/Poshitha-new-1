import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { updateShop, uploadShopLogo } from '@/services/shops';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Store, Phone, Mail, MapPin, Crown, Loader2,
  Camera, Building2, Sparkles,
} from 'lucide-react';

export default function ShopProfilePage() {
  const { profile, shop, refreshShop } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (shop) {
      setName(shop.name || '');
      setPhone(shop.phone || '');
      setEmail(shop.email || '');
      setAddress(shop.address || '');
      setLogoUrl(shop.logo_url || null);
    }
  }, [shop]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !shop) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      toast.error('JPEG, PNG, WEBP හෝ GIF format භාවිතා කරන්න');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('ගොනු ප්‍රමාණය 2MB ට අඩු විය යුතුය');
      return;
    }

    setUploading(true);
    try {
      const url = await uploadShopLogo(shop.id, file);
      setLogoUrl(url);
      await updateShop(shop.id, { logo_url: url });
      await refreshShop();
      toast.success('Logo සාර්ථකව ආරෝපණය කෙරිණි');
    } catch (err) {
      toast.error('Logo ආරෝපණය අසාර්ථකයි');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    if (!name.trim()) {
      toast.error('කඩයේ නම ඇතුළත් කරන්න');
      return;
    }

    setSaving(true);
    try {
      await updateShop(shop.id, {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
      });
      await refreshShop();
      toast.success('කඩයේ විස්තර සාර්ථකව යාවත්කාලීන කෙරිණි');
    } catch (err) {
      toast.error('යාවත්කාලීන කිරීම අසාර්ථකයි');
    } finally {
      setSaving(false);
    }
  };

  if (!shop) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Page title */}
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground text-balance">
            කඩයේ Profile
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ඔබගේ කඩයේ තොරතුරු සහ සැකසුම් කළමනාකරණය කරන්න
          </p>
        </div>

        {/* Plan badge card */}
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-4">
              {/* Logo preview */}
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center overflow-hidden border border-border">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Shop logo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Store className="w-7 h-7 text-muted-foreground" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:opacity-90 transition-opacity"
                  aria-label="Logo වෙනස් කරන්න"
                >
                  {uploading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Camera className="w-3 h-3" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>

              {/* Shop name + plan */}
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-foreground truncate">{shop.name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  ID: {shop.id.slice(0, 8)}...
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {shop.plan === 'pro' ? (
                    <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500">
                      <Crown className="w-3 h-3" />
                      Pro Plan
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <Sparkles className="w-3 h-3" />
                      Free Plan
                    </Badge>
                  )}
                  <Badge
                    variant={shop.status === 'active' ? 'default' : 'destructive'}
                    className={shop.status === 'active' ? 'bg-green-600 hover:bg-green-600 text-white' : ''}
                  >
                    {shop.status === 'active' ? 'සක්‍රිය' : 'අක්‍රිය'}
                  </Badge>
                </div>
              </div>
            </div>

            {shop.plan === 'free' && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <Crown className="w-3.5 h-3.5 inline mr-1" />
                  Pro Plan වෙත upgrade කිරීමෙන් වැඩිදුර features ලබාගන්න
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit form */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <CardTitle className="text-base">කඩයේ තොරතුරු</CardTitle>
            </div>
            <CardDescription>
              කඩයේ නම, සම්බන්ධතා විස්තර සහ ලිපිනය යාවත්කාලීන කරන්න
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sp-name" className="text-sm font-normal">
                  <Store className="w-3.5 h-3.5 inline mr-1.5 text-muted-foreground" />
                  කඩයේ නම <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sp-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="මගේ සිල්ලර කඩය"
                  className="px-3"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sp-phone" className="text-sm font-normal">
                  <Phone className="w-3.5 h-3.5 inline mr-1.5 text-muted-foreground" />
                  දුරකථන අංකය
                </Label>
                <Input
                  id="sp-phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="077 123 4567"
                  className="px-3"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sp-email" className="text-sm font-normal">
                  <Mail className="w-3.5 h-3.5 inline mr-1.5 text-muted-foreground" />
                  Email
                </Label>
                <Input
                  id="sp-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="shop@example.com"
                  className="px-3"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sp-address" className="text-sm font-normal">
                  <MapPin className="w-3.5 h-3.5 inline mr-1.5 text-muted-foreground" />
                  ලිපිනය
                </Label>
                <Input
                  id="sp-address"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="No. 10, මල් වීදිය, කොළඹ 03"
                  className="px-3"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">
                  ලොගින් Admin: <span className="font-medium text-foreground">{profile?.username}</span>
                </p>
                <Button type="submit" disabled={saving} className="h-9">
                  {saving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />සුරකිමින්...</>
                  ) : (
                    'වෙනස්කම් සුරකින්න'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
