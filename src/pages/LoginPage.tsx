import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Store, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { signInWithUsername, signUpWithUsername } = useAuth();
  const navigate = useNavigate();

  // Login state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Register state
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [showRegPw, setShowRegPw] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      toast.error('පරිශීලක නාමය සහ මුරපදය ඇතුළත් කරන්න');
      return;
    }
    setLoginLoading(true);
    const { error } = await signInWithUsername(loginUsername.trim(), loginPassword);
    setLoginLoading(false);
    if (error) {
      toast.error('ලොගින් අසාර්ථකයි - පරිශීලක නාමය හෝ මුරපදය වැරදිය');
    } else {
      toast.success('සාර්ථකව ලොගින් විය!');
      navigate('/billing');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername.trim() || !regPassword.trim()) {
      toast.error('සියලු ක්ෂේත්‍ර පිරවිය යුතුය');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(regUsername.trim())) {
      toast.error('පරිශීලක නාමය: අකුරු, ඉලක්කම් සහ _ පමණි');
      return;
    }
    if (regPassword.length < 6) {
      toast.error('මුරපදය අක්ෂර 6 ට වැඩි විය යුතුය');
      return;
    }
    if (regPassword !== regConfirm) {
      toast.error('මුරපද ගැලපෙන්නේ නැත');
      return;
    }
    if (!agreed) {
      toast.error('කරුණාකර කොන්දේසි වලට එකඟ වන්න');
      return;
    }
    setRegLoading(true);
    const { error } = await signUpWithUsername(regUsername.trim(), regPassword);
    setRegLoading(false);
    if (error) {
      toast.error(`ලියාපදිංචිය අසාර්ථකයි: ${error.message}`);
    } else {
      toast.success('ගිණුම සාර්ථකව සෑදිණි! ලොගින් වන්න');
      navigate('/billing');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4 shadow-hover">
            <Store className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground text-balance">POShitha Pro</h1>
          <p className="text-sm text-muted-foreground mt-1">ප්‍රවේශ ගැනීමට ලොගින් වන්න</p>
        </div>

        <Card className="shadow-card">
          <Tabs defaultValue="login">
            <TabsList className="w-full rounded-none border-b bg-transparent h-auto p-0">
              <TabsTrigger
                value="login"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 text-sm font-medium"
              >
                ලොගින්
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3 text-sm font-medium"
              >
                ලියාපදිංචිය
              </TabsTrigger>
            </TabsList>

            {/* Login tab */}
            <TabsContent value="login">
              <CardHeader>
                <CardTitle className="text-lg">ලොගින්</CardTitle>
                <CardDescription>ඔබගේ ගිණුමට ප්‍රවේශ වන්න</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-username" className="text-sm font-normal">
                      පරිශීලක නාමය
                    </Label>
                    <Input
                      id="login-username"
                      placeholder="admin"
                      value={loginUsername}
                      onChange={e => setLoginUsername(e.target.value)}
                      autoComplete="username"
                      className="px-3"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password" className="text-sm font-normal">
                      මුරපදය
                    </Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showLoginPw ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        autoComplete="current-password"
                        className="px-3 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowLoginPw(v => !v)}
                      >
                        {showLoginPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-10" disabled={loginLoading}>
                    {loginLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ලොගින් වෙමින්...</>
                    ) : (
                      'ලොගින්'
                    )}
                  </Button>
              <p className="text-xs text-muted-foreground text-center">
                  পেরনিমি: admin / admin123
                </p>
                <div className="text-center pt-1">
                  <Link
                    to="/register-shop"
                    className="text-xs text-primary hover:underline"
                  >
                    + නව කඩයක් ලියාපදිංචි කරන්න
                  </Link>
                </div>
                </form>
              </CardContent>
            </TabsContent>

            {/* Register tab */}
            <TabsContent value="register">
              <CardHeader>
                <CardTitle className="text-lg">නව ගිණුමක්</CardTitle>
                <CardDescription>Cashier ගිණුමක් සාදන්න (Admin විසින් role වෙනස් කළ හැකිය)</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-username" className="text-sm font-normal">
                      පරිශීලක නාමය
                    </Label>
                    <Input
                      id="reg-username"
                      placeholder="cashier01"
                      value={regUsername}
                      onChange={e => setRegUsername(e.target.value)}
                      autoComplete="username"
                      className="px-3"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-password" className="text-sm font-normal">
                      මුරපදය
                    </Label>
                    <div className="relative">
                      <Input
                        id="reg-password"
                        type={showRegPw ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                        className="px-3 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowRegPw(v => !v)}
                      >
                        {showRegPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-confirm" className="text-sm font-normal">
                      මුරපදය නැවත ඇතුළත් කරන්න
                    </Label>
                    <Input
                      id="reg-confirm"
                      type="password"
                      placeholder="••••••••"
                      value={regConfirm}
                      onChange={e => setRegConfirm(e.target.value)}
                      className="px-3"
                    />
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="agreed"
                      checked={agreed}
                      onCheckedChange={v => setAgreed(!!v)}
                      className="mt-0.5"
                    />
                    <label htmlFor="agreed" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                      <Link to="/terms" className="text-primary hover:underline">
                        පරිශීලක ගිවිසුම
                      </Link>{' '}
                      සහ{' '}
                      <Link to="/privacy" className="text-primary hover:underline">
                        රහස්‍යතා ප්‍රතිපත්තිය
                      </Link>{' '}
                      සඳහා කැමැත්ත දෙමි
                    </label>
                  </div>
                  <Button type="submit" className="w-full h-10" disabled={regLoading}>
                    {regLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ලියාපදිංචි කරමින්...</>
                    ) : (
                      'ලියාපදිංචි වන්න'
                    )}
                  </Button>
                </form>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
