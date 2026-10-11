import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import {
  fetchProducts,
  fetchProduct,
  callRpc,
} from '@/lib/api';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('API Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchProducts', () => {
    it('fetches products successfully with pagination and total count', async () => {
      const mockProducts = [
        { id: 'p1', name: 'Product A', cost_price: 100, selling_price: 150 },
        { id: 'p2', name: 'Product B', cost_price: 200, selling_price: 300 },
      ];

      const rangeMock = vi.fn().mockResolvedValue({
        data: mockProducts,
        error: null,
        count: 2,
      });

      const orderMock = vi.fn().mockReturnValue({
        range: rangeMock,
      });

      const selectMock = vi.fn().mockReturnValue({
        order: orderMock,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock,
      } as unknown as ReturnType<typeof supabase.from>);

      const result = await fetchProducts();
      expect(result.data).toEqual(mockProducts);
      expect(result.total).toBe(2);
      expect(supabase.from).toHaveBeenCalledWith('products');
    });

    it('throws error when supabase query fails', async () => {
      const rangeMock = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Database error'),
        count: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: rangeMock,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      await expect(fetchProducts()).rejects.toThrow('Database error');
    });
  });

  describe('fetchProduct', () => {
    it('fetches a single product by id', async () => {
      const mockProduct = { id: 'p1', name: 'Product A' };
      const maybeSingleMock = vi.fn().mockResolvedValue({
        data: mockProduct,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: maybeSingleMock,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      const res = await fetchProduct('p1');
      expect(res).toEqual(mockProduct);
    });
  });

  describe('callRpc', () => {
    it('invokes RPC function with arguments', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { total_sales: 50000 },
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>);

      const res = await callRpc<{ total_sales: number }>('get_dashboard_metrics', { p_start_date: '2026-01-01' });
      expect(res).toEqual({ total_sales: 50000 });
      expect(supabase.rpc).toHaveBeenCalledWith('get_dashboard_metrics', { p_start_date: '2026-01-01' });
    });

    it('throws when RPC returns error', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: new Error('RPC failure'),
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>);

      await expect(callRpc('unknown_func')).rejects.toThrow('RPC failure');
    });
  });
});
