import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from '@/components/toast';

function TestConsumer() {
  const { toast } = useToast();
  return (
    <div>
      <button onClick={() => toast('Transaction created successfully', 'success')}>
        Trigger Success
      </button>
      <button onClick={() => toast('Something went wrong', 'error')}>
        Trigger Error
      </button>
    </div>
  );
}

describe('Toast System', () => {
  it('renders toasts and dismisses on close button click', async () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    const successBtn = screen.getByText('Trigger Success');
    fireEvent.click(successBtn);

    expect(screen.getByText('Transaction created successfully')).toBeInTheDocument();

    // Click close button
    const closeBtn = screen.getByRole('button', { name: '' });
    fireEvent.click(closeBtn);

    expect(screen.queryByText('Transaction created successfully')).not.toBeInTheDocument();
  });

  it('renders error toast notification', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    const errorBtn = screen.getByText('Trigger Error');
    fireEvent.click(errorBtn);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
