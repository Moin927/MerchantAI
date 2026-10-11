import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, Badge, Card, Input, Textarea, Select, EmptyState, Spinner } from '@/components/ui';
import { Store } from 'lucide-react';

describe('UI Component Library', () => {
  describe('Button', () => {
    it('renders text and handles click events', () => {
      let clicked = false;
      render(<Button onClick={() => { clicked = true; }}>Click Me</Button>);
      const btn = screen.getByRole('button', { name: /click me/i });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(clicked).toBe(true);
    });

    it('renders loading state and is disabled', () => {
      render(<Button loading>Submit</Button>);
      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
    });

    it('applies variant classes properly', () => {
      const { rerender } = render(<Button variant="danger">Delete</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-red-600');

      rerender(<Button variant="secondary">Secondary</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-blue-600');
    });
  });

  describe('Badge', () => {
    it('renders with different variants', () => {
      const { rerender } = render(<Badge variant="success">Completed</Badge>);
      expect(screen.getByText('Completed')).toHaveClass('bg-emerald-100');

      rerender(<Badge variant="warning">Pending</Badge>);
      expect(screen.getByText('Pending')).toHaveClass('bg-amber-100');

      rerender(<Badge variant="error">Cancelled</Badge>);
      expect(screen.getByText('Cancelled')).toHaveClass('bg-red-100');
    });
  });

  describe('Card', () => {
    it('renders children with appropriate card classes', () => {
      render(
        <Card className="test-card">
          <span>Card Content</span>
        </Card>
      );
      expect(screen.getByText('Card Content')).toBeInTheDocument();
      expect(screen.getByText('Card Content').parentElement).toHaveClass('test-card');
    });
  });

  describe('Input and Textarea', () => {
    it('renders Input with label, placeholder, and error', () => {
      render(
        <Input
          label="Customer Name"
          placeholder="Enter name"
          error="Name is required"
        />
      );
      expect(screen.getByText('Customer Name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter name')).toBeInTheDocument();
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });

    it('handles Input typing', () => {
      let value = '';
      render(
        <Input
          placeholder="Type here"
          onChange={(e) => { value = e.target.value; }}
        />
      );
      const input = screen.getByPlaceholderText('Type here');
      fireEvent.change(input, { target: { value: 'Test Value' } });
      expect(value).toBe('Test Value');
    });

    it('renders Textarea with label and value', () => {
      render(<Textarea label="Notes" placeholder="Additional notes..." defaultValue="Initial note" />);
      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Additional notes...')).toHaveValue('Initial note');
    });
  });

  describe('Select', () => {
    it('renders Select element with options', () => {
      render(
        <Select label="Status" defaultValue="active">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      );
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Active')).toBeInTheDocument();
    });
  });

  describe('EmptyState & Spinner', () => {
    it('renders EmptyState with icon, title, and action', () => {
      render(
        <EmptyState
          icon={Store}
          title="No Products Found"
          description="Try creating a new product."
          action={<button>Add Product</button>}
        />
      );
      expect(screen.getByText('No Products Found')).toBeInTheDocument();
      expect(screen.getByText('Try creating a new product.')).toBeInTheDocument();
      expect(screen.getByText('Add Product')).toBeInTheDocument();
    });

    it('renders Spinner without crashing', () => {
      const { container } = render(<Spinner className="h-6 w-6" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });
});
