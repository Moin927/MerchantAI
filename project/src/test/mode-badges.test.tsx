import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AiModeBadge, PaymentModeBadge, ModeBadge } from '@/components/mode-badges';

describe('Mode Badges', () => {
  it('renders AiModeBadge in demo and live modes', () => {
    const { rerender } = render(<AiModeBadge mode="demo" />);
    expect(screen.getByText('AI Demo Mode')).toBeInTheDocument();

    rerender(<AiModeBadge mode="live" />);
    expect(screen.getByText('AI Live Mode')).toBeInTheDocument();
  });

  it('renders PaymentModeBadge in demo and devnet modes', () => {
    const { rerender } = render(<PaymentModeBadge mode="demo" />);
    expect(screen.getByText('Payment Demo Mode')).toBeInTheDocument();

    rerender(<PaymentModeBadge mode="devnet" />);
    expect(screen.getByText('Solana Devnet')).toBeInTheDocument();
  });

  it('renders composite ModeBadge container', () => {
    render(<ModeBadge />);
    expect(screen.getByText('AI Demo Mode')).toBeInTheDocument();
    expect(screen.getByText('Payment Demo Mode')).toBeInTheDocument();
  });
});
