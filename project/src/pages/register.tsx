import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button, Input } from '@/components/ui';
import { useToast } from '@/components/toast';
import { Store, ArrowRight } from 'lucide-react';

export function RegisterPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast('Password must be at least 6 characters', 'error');
      return;
    }
    setLoading(true);
    try {
      // Step 1: Create auth account
      let userId: string | null = null;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        const msg = authError.message.toLowerCase();
        // If user already exists or email rate limit was triggered,
        // attempt to sign in with password to recover the session without sending an email
        if (msg.includes('already registered') || msg.includes('rate limit')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (!signInError && signInData?.user) {
            userId = signInData.user.id;
          } else {
            if (msg.includes('rate limit')) {
              throw new Error('Email rate limit exceeded. Please disable "Confirm email" in your Supabase Dashboard (Authentication > Providers > Email) or log in if your account is already created.');
            }
            throw authError;
          }
        } else {
          throw authError;
        }
      } else if (authData?.user) {
        userId = authData.user.id;
      }

      if (!userId) throw new Error('Registration failed');

      // Check if user already has a business/profile (recovery flow)
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('business_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingProfile) {
        toast('Welcome back! Logged in successfully.', 'success');
        navigate('/app/dashboard');
        return;
      }

      // Step 2: Create business
      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .insert({
          name: businessName,
          business_type: 'retail',
          currency: 'PKR',
          timezone: 'Asia/Karachi',
          owner_id: userId,
        })
        .select()
        .single();

      if (businessError) throw businessError;

      // Step 3: Create profile linking user to business
      const { error: profileError } = await supabase.from('profiles').insert({
        user_id: userId,
        business_id: businessData.id,
        name,
        email,
        role: 'owner',
        is_active: true,
      });

      if (profileError) throw profileError;

      toast('Account created successfully!', 'success');
      navigate('/app/dashboard');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 mb-3">
            <Store className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="text-sm text-slate-500 mt-1">Start managing your business today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <Input
            label="Your name"
            name="name"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Business name"
            name="businessName"
            placeholder="Moin Electronics"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            required
          />
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
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            {!loading && <>Create account <ArrowRight className="h-4 w-4" /></>}
          </Button>
          <p className="text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-slate-900 hover:underline">
              Sign in
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
