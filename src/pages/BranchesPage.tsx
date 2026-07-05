import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { getBranches, addBranch, updateBranch, deleteBranch } from '@/services/branches';
import { useAuth } from '@/contexts/AuthContext';
import type { Branch } from '@/types/index';
import { Building2, Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react';

export default function BranchesPage() {
  const { profile } = useAuth();
  const shopId = profile?.shop_id ?? '';
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', address: '' });
  const [saving, setSaving] = useState(false);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    try {
      setBranches(await getBranches());
    } catch {
      toast.error('ශාඛා ලබාගැනීමේ දෝෂය');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  const openAdd = () => {
    setEditBranch(null);
    setForm({ name: '', address: '' });
    setDialogOpen(true);
  };

  const openEdit = (b: Branch) => {
    setEditBranch(b);
    setForm({ name: b.name, address: b.address ?? '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('ශාඛා නාමය ඇතුළත් කරන්න'); return; }
    setSaving(true);
    try {
      if (editBranch) {
        await updateBranch(editBranch.id, { name: form.name.trim(), address: form.address.trim() || null });
        toast.success('ශාඛාව යාවත්කාලීන කළා');
      } else {
        await addBranch(form.name.trim(), form.address.trim() || null, shopId);
        toast.success('ශාඛාව එකතු කළා');
      }
      setDialogOpen(false);
      loadBranches();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'දෝෂය';
      toast.error(msg.includes('duplicate') || msg.includes('unique') ? 'ශාඛා නාමය දැනටමත් ඇත' : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteBranch(deleteTarget.id);
      toast.success('ශාඛාව ඉවත් කළා');
      setDeleteTarget(null);
      loadBranches();
    } catch {
      toast.error('ශාඛාව ඉවත් කිරීම අසාර්ථකයි — භාණ්ඩ හෝ invoices සම්බන්ධ විය හැකිය');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-balance">ශාඛා කළමනාකරණය</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={loadBranches} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="sr-only md:not-sr-only">යාවත්කාලීන</span>
            </Button>
            <Button size="sm" onClick={openAdd} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>නව ශාඛාව</span>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="h-full">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">සම්පූර්ණ ශාඛා</p>
              {loading ? <Skeleton className="h-7 w-12 mt-1 bg-muted" /> : (
                <p className="text-2xl font-bold mt-1 text-primary">{branches.length}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="w-full max-w-full overflow-x-auto bg-card rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">ශාඛා නාමය</TableHead>
                    <TableHead className="whitespace-nowrap">ලිපිනය</TableHead>
                    <TableHead className="whitespace-nowrap">ලියාපදිංචි දිනය</TableHead>
                    <TableHead className="whitespace-nowrap text-right">ක්‍රියා</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 4 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-5 w-full bg-muted" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : branches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-muted-foreground whitespace-nowrap">
                        ශාඛා නොමැත. නව ශාඛාවක් එකතු කරන්න.
                      </TableCell>
                    </TableRow>
                  ) : (
                    branches.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="whitespace-nowrap font-semibold">{b.name}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{b.address ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(b.created_at).toLocaleDateString('si-LK')}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(b)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(b)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editBranch ? 'ශාඛාව සංස්කරණය' : 'නව ශාඛාව'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-normal">ශාඛා නාමය</Label>
              <Input
                placeholder="ප්‍රධාන ශාඛාව"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="px-3"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-normal">ලිපිනය (විකල්ප)</Label>
              <Input
                placeholder="No. 10, කොළඹ"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="px-3"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>අවලංගු</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'සුරකිමින්...' : (editBranch ? 'යාවත්කාලීන' : 'එකතු කරන්න')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>ශාඛාව ඉවත් කරන්නද?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" ඉවත් කිරීම ස්ථිර ක්‍රියාවකි.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>අවලංගු</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              ඉවත් කරන්න
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
