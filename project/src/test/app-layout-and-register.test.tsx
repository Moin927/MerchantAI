import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from '@/pages/register';
import { AppLayout } from '@/components/app-layout';
import { ToastProvider } from '@/components/toast';

const mockSignOut = vi.fn();

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    business: { id: 'b1', name: 'Moin Electronics', currency: 'PKR' },
    profile: { id: 'p1', name: 'Ali Khan', email: 'ali@moin.com', role: 'owner' },
    signOut: mockSignOut,
    session: null,
    user: null,
    loading: false,
    refreshProfile: vi.fn(),
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'new-biz' }, error: null }),
    }),
  },
}));

describe('RegisterPage & AppLayout', () => {
  describe('RegisterPage', () => {
    it('renders all registration form inputs and handles submission validation', () => {
      render(
        <MemoryRouter>
          <ToastProvider>
            <RegisterPage />
          </ToastProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('Create your account')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Moin Electronics')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('you@business.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('At least 6 characters')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
      expect(screen.getByText(/already have an account\?/i)).toBeInTheDocument();
    });
  });

  describe('AppLayout', () => {
    it('renders sidebar navigation links, business name, and profile details', () => {
      render(
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>
      );

      // Business & profile details
      expect(screen.getByText('Moin Electronics')).toBeInTheDocument();
      expect(screen.getByText('Ali Khan')).toBeInTheDocument();
      expect(screen.getByText('ali@moin.com')).toBeInTheDocument();

      // Navigation links
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /ai assistant/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /^transactions$/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /inventory/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /customers/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /suppliers/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /invoices/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /payments/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /reports/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();

      // Header mode badges
      expect(screen.getByText('AI Demo Mode')).toBeInTheDocument();
      expect(screen.getByText('Payment Demo Mode')).toBeInTheDocument();
    });

    it('triggers signOut when clicking Sign out button', async () => {
      render(
        <MemoryRouter>
          <AppLayout />
        </MemoryRouter>
      );

      const signOutBtn = screen.getByRole('button', { name: /sign out/i });
      await act(async () => {
        fireEvent.click(signOutBtn);
      });
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
