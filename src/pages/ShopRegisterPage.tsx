import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Store, Eye, EyeOff, Loader2, Building2, ArrowLeft } from 'lucide-react';

export default function ShopRegisterPage() {
  const { registerShop } = useAuth();
  const navigate = useNavigate();

  const [shopName, setShopName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!shopName.trim()) {
      toast.error('කඩයේ නම ඇතුළත් කරන්න');
      return;
    }
    if (!username.trim()) {
      toast.error('පරිශීලක නාමය ඇතුළත් කරන්න');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      toast.error('පරිශීලක නාමය: අකුරු, ඉලක්කම් සහ _ පමණි');
      return;
    }
    if (password.length < 6) {
      toast.error('මුරපදය අක්ෂර 6 ට වැඩි විය යුතුය');
      return;
    }
    if (password !== confirm) {
      toast.error('මුරපද ගැලපෙන්නේ නැත');
      return;
    }

    setLoading(true);
    const { error } = await registerShop(
      shopName.trim(),
      username.trim(),
      password,
      email.trim() || undefined
    );
    setLoading(false);

    if (error) {
      toast.error(`ලියාපදිංචිය අසාර්ථකයි: ${error.message}`);
    } else {
      toast.success('කඩය සාර්ථකව ලියාපදිංචි විය! ලොගින් වන්න');
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 shadow-lg">
            <Store className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground text-balance">POShitha Pro</h1>
          <p className="text-sm text-muted-foreground mt-1">නව කඩයක් ලියාපදිංචි කරන්න</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg">කඩය ලියාපදිංචිය</CardTitle>
            </div>
            <CardDescription>ඔබගේ කඩය සඳහා නව ගිණුමක් සාදන්න</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Shop name */}
              <div className="space-y-1.5">
                <Label htmlFor="shop-name" className="text-sm font-normal">
                  කඩයේ නම <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="shop-name"
                  placeholder="මගේ සිල්ලර කඩය"
                  value={shopName}
                  onChange={e => setShopName(e.target.value)}
                  className="px-3"
                />
              </div>

              {/* Username */}
              <div className="space-y-1.5">
                <Label htmlFor="reg-username" className="text-sm font-normal">
                  Admin පරිශීලක නාමය <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reg-username"
                  placeholder="admin"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  className="px-3"
                />
              </div>

              {/* Email (optional) */}
              <div className="space-y-1.5">
                <Label htmlFor="reg-email" className="text-sm font-normal">
                  Email (විකල්ප)
                </Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="shop@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  className="px-3"
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="reg-password" className="text-sm font-normal">
                  මුරපදය <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="reg-password"
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="px-3 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPw(v => !v)}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label htmlFor="reg-confirm" className="text-sm font-normal">
                  මුරපදය නැවත ඇතුළත් කරන්න <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="reg-confirm"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="px-3"
                />
              </div>

              <Button type="submit" className="w-full h-10" disabled={loading}>
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ලියාපදිංචි කරමින්...</>
                ) : (
                  'කඩය ලියාපදිංචි කරන්න'
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                දැනටමත් ගිණුමක් තිබේ නම් ලොගින් වන්න
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Free Plan — කඩ ලියාපදිංචිය නොමිලේ
        </p>
      </div>
    </div>
  );
}
