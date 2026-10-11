import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from '@/pages/landing';
import { LoginPage } from '@/pages/login';
import { ToastProvider } from '@/components/toast';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

describe('Landing & Login Pages', () => {
  describe('LandingPage', () => {
    it('renders hero title, feature highlights, and call to action buttons', () => {
      render(
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      );

      expect(screen.getAllByText(/AI-Powered/i).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('link', { name: /get started/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('link', { name: /sign in/i }).length).toBeGreaterThan(0);
      expect(screen.getByText(/smart inventory/i)).toBeInTheDocument();
      expect(screen.getByText(/ai assistant/i)).toBeInTheDocument();
    });
  });

  describe('LoginPage', () => {
    it('renders login form inputs for email and password', () => {
      render(
        <MemoryRouter>
          <ToastProvider>
            <LoginPage />
          </ToastProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('Sign in to your business dashboard')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('you@business.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByText(/no account\?/i)).toBeInTheDocument();
    });
  });
});
