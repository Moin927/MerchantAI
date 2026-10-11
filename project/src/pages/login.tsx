import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button, Input } from '@/components/ui';
import { useToast } from '@/components/toast';
import { Store, ArrowRight } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast('Welcome back!', 'success');
      navigate('/app/dashboard');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 mb-3">
            <Store className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">MerchantAI</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to your business dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <Input
            label="Email"
            type="email"
            name="email"
            placeholder="you@business.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            name="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            {!loading && <>Sign in <ArrowRight className="h-4 w-4" /></>}
          </Button>
          <p className="text-center text-sm text-slate-500">
            No account?{' '}
            <Link to="/register" className="font-medium text-slate-900 hover:underline">
              Create one
            </Link>
          </p>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          <Link to="/" className="hover:text-slate-600">Back to home</Link>
        </p>
      </div>
    </div>
  );
}
