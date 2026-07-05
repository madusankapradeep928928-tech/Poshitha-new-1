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
import { getSuppliers, addSupplier, updateSupplier, deleteSupplier } from '@/services/suppliers';
import { useAuth } from '@/contexts/AuthContext';
import type { Supplier } from '@/types/index';
import { Truck, Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react';

export default function SuppliersPage() {
  const { profile } = useAuth();
  const shopId = profile?.shop_id ?? '';
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      setSuppliers(await getSuppliers());
    } catch {
      toast.error('සැපයුම්කරුවන් ලබාගැනීමේ දෝෂය');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const openAdd = () => {
    setEditSupplier(null);
    setForm({ name: '', phone: '', email: '' });
    setDialogOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditSupplier(s);
    setForm({ name: s.name, phone: s.phone ?? '', email: s.email ?? '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('සැපයුම්කරු නාමය ඇතුළත් කරන්න'); return; }
    setSaving(true);
    try {
      const name = form.name.trim();
      const phone = form.phone.trim() || null;
      const email = form.email.trim() || null;
      if (editSupplier) {
        await updateSupplier(editSupplier.id, { name, phone, email });
        toast.success('සැපයුම්කරු යාවත්කාලීන කළා');
      } else {
        await addSupplier(name, phone, email, shopId);
        toast.success('සැපයුම්කරු එකතු කළා');
      }
      setDialogOpen(false);
      loadSuppliers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'දෝෂය');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSupplier(deleteTarget.id);
      toast.success('සැපයුම්කරු ඉවත් කළා');
      setDeleteTarget(null);
      loadSuppliers();
    } catch {
      toast.error('ඉවත් කිරීම අසාර්ථකයි — සම්බන්ධ භාණ්ඩ තිබිය හැකිය');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-balance">සැපයුම්කරු කළමනාකරණය</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={loadSuppliers} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="sr-only md:not-sr-only">යාවත්කාලීන</span>
            </Button>
            <Button size="sm" onClick={openAdd} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>නව සැපයුම්කරු</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="h-full">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">සම්පූර්ණ සැපයුම්කරුවන්</p>
              {loading ? <Skeleton className="h-7 w-12 mt-1 bg-muted" /> : (
                <p className="text-2xl font-bold mt-1 text-primary">{suppliers.length}</p>
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
                    <TableHead className="whitespace-nowrap">නාමය</TableHead>
                    <TableHead className="whitespace-nowrap">දුරකථනය</TableHead>
                    <TableHead className="whitespace-nowrap">Email</TableHead>
                    <TableHead className="whitespace-nowrap">ලියාපදිංචි දිනය</TableHead>
                    <TableHead className="whitespace-nowrap text-right">ක්‍රියා</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-5 w-full bg-muted" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : suppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground whitespace-nowrap">
                        සැපයුම්කරුවන් නොමැත. නව සැපයුම්කරුවකු එකතු කරන්න.
                      </TableCell>
                    </TableRow>
                  ) : (
                    suppliers.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap font-semibold">{s.name}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{s.phone ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{s.email ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(s.created_at).toLocaleDateString('si-LK')}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(s)}
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
            <DialogTitle>{editSupplier ? 'සැපයුම්කරු සංස්කරණය' : 'නව සැපයුම්කරු'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-normal">නාමය</Label>
              <Input
                placeholder="ABC Distributors"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="px-3"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-normal">දුරකථනය (විකල්ප)</Label>
                <Input
                  placeholder="077 1234567"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="px-3"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-normal">Email (විකල්ප)</Label>
                <Input
                  type="email"
                  placeholder="info@abc.lk"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="px-3"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>අවලංගු</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'සුරකිමින්...' : (editSupplier ? 'යාවත්කාලීන' : 'එකතු කරන්න')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>සැපයුම්කරු ඉවත් කරන්නද?</AlertDialogTitle>
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
