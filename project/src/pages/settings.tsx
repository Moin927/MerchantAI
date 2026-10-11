import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/toast';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Input, Select, Card, PageHeader, Badge } from '@/components/ui';
import { AiModeBadge, PaymentModeBadge } from '@/components/mode-badges';
import { Store, User, Sparkles, Database } from 'lucide-react';

export function SettingsPage() {
  const { business, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bizName, setBizName] = useState(business?.name ?? '');
  const [bizType, setBizType] = useState(business?.business_type ?? 'retail');
  const [currency, setCurrency] = useState(business?.currency ?? 'PKR');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleSave = async () => {
    if (!business) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('businesses').update({
        name: bizName, business_type: bizType, currency, updated_at: new Date().toISOString(),
      }).eq('id', business.id);
      if (error) throw error;
      toast('Settings saved', 'success');
      queryClient.invalidateQueries({ queryKey: ['business'] });
    } catch (err) { toast(err instanceof Error ? err.message : 'Failed', 'error'); }
    finally { setSaving(false); }
  };

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seed-demo`;
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed: ${response.status} ${text}`);
      }
      const result = await response.json();
      toast(`Demo data loaded: ${result.message ?? 'success'}`, 'success');
      queryClient.invalidateQueries();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Seeding failed', 'error');
    } finally { setSeeding(false); }
  };

  return (
    <div>
      <PageHeader title="Settings" description="Manage your business profile and system configuration" />

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100"><Store className="h-5 w-5 text-slate-600" /></div>
            <h2 className="font-semibold text-slate-900">Business Profile</h2>
          </div>
          <div className="space-y-4">
            <Input label="Business Name" value={bizName} onChange={(e) => setBizName(e.target.value)} />
            <Select label="Business Type" value={bizType} onChange={(e) => setBizType(e.target.value)}>
              <option value="retail">Retail</option><option value="wholesale">Wholesale</option>
              <option value="services">Services</option><option value="manufacturing">Manufacturing</option>
              <option value="restaurant">Restaurant</option><option value="other">Other</option>
            </Select>
            <Select label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="PKR">PKR - Pakistani Rupee</option><option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option><option value="GBP">GBP - British Pound</option>
              <option value="INR">INR - Indian Rupee</option><option value="AED">AED - UAE Dirham</option>
            </Select>
            <Button loading={saving} onClick={handleSave}>Save Changes</Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100"><User className="h-5 w-5 text-slate-600" /></div>
              <h2 className="font-semibold text-slate-900">Your Profile</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Name</span><span className="font-medium text-slate-900">{profile?.name}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Email</span><span className="font-medium text-slate-900">{profile?.email}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-500">Role</span><Badge variant="info">{profile?.role}</Badge></div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100"><Sparkles className="h-5 w-5 text-slate-600" /></div>
              <h2 className="font-semibold text-slate-900">System Mode</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><span className="text-sm text-slate-500">AI Provider</span><AiModeBadge mode="demo" /></div>
              <div className="flex items-center justify-between"><span className="text-sm text-slate-500">Payment System</span><PaymentModeBadge mode="demo" /></div>
              <p className="text-xs text-slate-400 mt-3">The app runs in demo mode by default. No paid API keys are required. AI features use a deterministic rule-based parser. Solana payments are simulated.</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50"><Database className="h-5 w-5 text-amber-600" /></div>
              <h2 className="font-semibold text-slate-900">Demo Data</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">Load synthetic demo data (Moin Electronics with products, customers, suppliers, and transactions) to explore the app quickly.</p>
            <Button variant="outline" loading={seeding} onClick={handleSeedDemo}><Database className="h-4 w-4" /> Load Demo Data</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
