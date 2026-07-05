import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { getBranches } from '@/services/branches';
import { useAuth } from '@/contexts/AuthContext';
import type { Profile, Branch } from '@/types/index';
import { Users, RefreshCw, Shield, UserPlus, Trash2, Building2 } from 'lucide-react';

interface ProfileWithBranch extends Profile {
  branch_name?: string;
}

export default function UsersPage() {
  const { profile: currentProfile, addCashier } = useAuth();
  const isAdmin = currentProfile?.role === 'admin' || currentProfile?.role === 'super_admin';

  const [users, setUsers]       = useState<ProfileWithBranch[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading]   = useState(true);

  // Add user dialog
  const [addOpen, setAddOpen]         = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addBranch, setAddBranch]     = useState('none');
  const [adding, setAdding]           = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<ProfileWithBranch | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      // Join branches to get name; branch_id may be null
      const { data, error } = await supabase
        .from('profiles')
        .select('*, branches(name)')
        .order('created_at', { ascending: true });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      setUsers(rows.map((u: Profile & { branches?: { name: string } | null }) => ({
        ...u,
        branch_name: u.branches?.name ?? undefined,
      })));
    } catch {
      toast.error('පරිශීලකයින් ලබාගැනීමේ දෝෂය');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBranches = useCallback(async () => {
    if (!currentProfile?.shop_id) return;
    try {
      const data = await getBranches();
      setBranches(data);
    } catch {
      toast.error('ශාඛා ලබාගැනීමේ දෝෂය');
    }
  }, [currentProfile?.shop_id]);

  useEffect(() => {
    loadUsers();
    loadBranches();
  }, [loadUsers, loadBranches]);

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'cashier') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);
      if (error) throw error;
      toast.success('Role යාවත්කාලීන කළා');
      loadUsers();
    } catch {
      toast.error('Role වෙනස් කිරීම අසාර්ථකයි');
    }
  };

  const handleBranchChange = async (userId: string, branchId: string) => {
    const newBranchId = branchId === 'none' ? null : branchId;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ branch_id: newBranchId })
        .eq('id', userId);
      if (error) throw error;
      toast.success('ශාඛාව යාවත්කාලීන කළා');
      loadUsers();
    } catch {
      toast.error('ශාඛාව වෙනස් කිරීම අසාර්ථකයි');
    }
  };

  const handleAddUser = async () => {
    if (!addUsername.trim()) { toast.error('පරිශීලක නාමය ඇතුළත් කරන්න'); return; }
    if (addPassword.length < 6) { toast.error('මුරපදය අවම අකුරු 6ක් විය යුතුයි'); return; }
    setAdding(true);
    try {
      const branchId = addBranch === 'none' ? null : addBranch;
      const { error } = await addCashier(addUsername.trim(), addPassword, branchId);
      if (error) throw error;
      toast.success(`${addUsername} — Cashier ලෙස ලියාපදිංචි කළා`);
      setAddOpen(false);
      setAddUsername(''); setAddPassword(''); setAddBranch('none');
      loadUsers();
    } catch (err) {
      toast.error(`දෝෂය: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Delete auth user via admin API (service role needed) — only possible via Edge Function
      // For now: remove the profile; auth user stays but cannot log in with shop data
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success(`${deleteTarget.username} ඉවත් කළා`);
      setDeleteTarget(null);
      loadUsers();
    } catch {
      toast.error('ඉවත් කිරීම අසාර්ථකයි');
    } finally {
      setDeleting(false);
    }
  };

  const adminCount   = users.filter(u => u.role === 'admin').length;
  const cashierCount = users.filter(u => u.role === 'cashier').length;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-balance">පරිශීලක කළමනාකරණය</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={loadUsers} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="sr-only md:not-sr-only">යාවත්කාලීන</span>
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
                <UserPlus className="w-4 h-4" />
                <span>Cashier එකතු කරන්න</span>
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'සම්පූර්ණ',  value: users.length, color: 'text-foreground' },
            { label: 'Admin',      value: adminCount,   color: 'text-primary'    },
            { label: 'Cashier',    value: cashierCount, color: 'text-foreground' },
          ].map(({ label, value, color }) => (
            <Card key={label} className="h-full">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                {loading
                  ? <Skeleton className="h-7 w-12 mt-1 bg-muted" />
                  : <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
                }
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4" />
              පරිශීලකයින් ලැයිස්තුව
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full max-w-full overflow-x-auto bg-card rounded-b-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">පරිශීලක නාමය</TableHead>
                    <TableHead className="whitespace-nowrap">Role</TableHead>
                    <TableHead className="whitespace-nowrap">
                      <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />ශාඛාව</span>
                    </TableHead>
                    <TableHead className="whitespace-nowrap">ලියාපදිංචි දිනය</TableHead>
                    {isAdmin && <TableHead className="whitespace-nowrap text-right">ක්‍රියා</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: isAdmin ? 5 : 4 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-5 w-full bg-muted" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-12 text-muted-foreground">
                        පරිශීලකයින් නොමැත
                      </TableCell>
                    </TableRow>
                  ) : users.map(u => (
                    <TableRow key={u.id}>
                      {/* Username */}
                      <TableCell className="whitespace-nowrap font-medium">{u.username}</TableCell>

                      {/* Role */}
                      <TableCell className="whitespace-nowrap">
                        {isAdmin && u.id !== currentProfile?.id && u.role !== 'super_admin' ? (
                          <Select
                            value={u.role}
                            onValueChange={v => handleRoleChange(u.id, v as 'admin' | 'cashier')}
                          >
                            <SelectTrigger className="w-28 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cashier">Cashier</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={
                            u.role === 'super_admin' ? 'bg-amber-500 text-white hover:bg-amber-500' :
                            u.role === 'admin'       ? 'bg-primary text-primary-foreground' :
                            'bg-secondary text-secondary-foreground'
                          }>
                            {u.role === 'super_admin' ? 'Super Admin' :
                             u.role === 'admin'       ? 'Admin' : 'Cashier'}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Branch */}
                      <TableCell className="whitespace-nowrap">
                        {isAdmin && u.id !== currentProfile?.id && u.role !== 'super_admin' ? (
                          <Select
                            value={u.branch_id ?? 'none'}
                            onValueChange={v => handleBranchChange(u.id, v)}
                          >
                            <SelectTrigger className="w-40 h-8 text-xs">
                              <SelectValue placeholder="ශාඛාවක් නැත" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">ශාඛාවක් නැත</SelectItem>
                              {branches.map(b => (
                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {u.branch_name ?? '—'}
                          </span>
                        )}
                      </TableCell>

                      {/* Registered at */}
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString('si-LK')}
                      </TableCell>

                      {/* Actions */}
                      {isAdmin && (
                        <TableCell className="whitespace-nowrap text-right">
                          {u.id === currentProfile?.id || u.role === 'super_admin' ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget(u)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Add Cashier Dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              නව Cashier ලියාපදිංචිය
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-username" className="text-sm font-normal">පරිශීලක නාමය *</Label>
              <Input
                id="add-username"
                placeholder="e.g. nethmi"
                value={addUsername}
                onChange={e => setAddUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-password" className="text-sm font-normal">මුරපදය * (අවම 6 characters)</Label>
              <Input
                id="add-password"
                type="password"
                placeholder="••••••"
                value={addPassword}
                onChange={e => setAddPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-normal">ශාඛාව (විකල්ප)</Label>
              <Select value={addBranch} onValueChange={setAddBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="ශාඛාවක් තෝරන්න" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ශාඛාවක් නැත</SelectItem>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                ශාඛාවක් ලබා දෙන්නේ නම් එම Cashier ගේ POS හි ශාඛාවේ භාණ්ඩ පමණක් පෙන්වයි.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>
              අවලංගු
            </Button>
            <Button onClick={handleAddUser} disabled={adding}>
              {adding ? 'ලියාපදිංචි කරමින්…' : 'Cashier ලියාපදිංචි කරන්න'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              "{deleteTarget?.username}" ඉවත් කිරීම?
            </AlertDialogTitle>
            <AlertDialogDescription>
              මෙම පරිශීලකයා system එකෙන් ස්ථිරවම ඉවත් කෙරේ. ක්‍රියාව ආපසු හරවා ගත නොහැකිය.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>අවලංගු</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'ඉවත් කරමින්…' : 'ඉවත් කරන්න'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}


