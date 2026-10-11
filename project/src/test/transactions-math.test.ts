import { describe, it, expect } from 'vitest';

describe('Merchant Business Logic & Math Calculations', () => {
  describe('Sales Calculation', () => {
    it('calculates subtotal, tax, discount, total and amount due accurately', () => {
      const items = [
        { quantity: 2, unit_price: 350000 }, // 700,000
        { quantity: 3, unit_price: 15000 },  // 45,000
      ];

      const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
      expect(subtotal).toBe(745000);

      const discount = 5000;
      const tax = 10000;
      const total = subtotal - discount + tax;
      expect(total).toBe(750000);

      const amountPaid = 250000;
      const amountDue = total - amountPaid;
      expect(amountDue).toBe(500000);
    });

    it('calculates profit and margin percentage accurately', () => {
      const costPrice = 280000;
      const sellingPrice = 350000;
      const quantity = 2;

      const revenue = sellingPrice * quantity;
      const cogs = costPrice * quantity;
      const grossProfit = revenue - cogs;
      const marginPct = (grossProfit / revenue) * 100;

      expect(revenue).toBe(700000);
      expect(cogs).toBe(560000);
      expect(grossProfit).toBe(140000);
      expect(marginPct).toBeCloseTo(20, 2);
    });
  });

  describe('Invoice Line Items & Totals', () => {
    it('calculates line items with custom discount and tax', () => {
      const items = [
        { quantity: 5, unit_price: 2500 }, // 12,500
        { quantity: 1, unit_price: 7500 }, // 7,500
      ];

      const subtotal = items.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
      expect(subtotal).toBe(20000);

      const discountAmount = 1000;
      const taxAmount = 1900;
      const totalAmount = subtotal - discountAmount + taxAmount;
      expect(totalAmount).toBe(20900);
    });
  });

  describe('Inventory Delta Calculations', () => {
    it('computes stock changes after sales and restocks', () => {
      let currentStock = 25;
      const saleQty = 3;
      currentStock -= saleQty;
      expect(currentStock).toBe(22);

      const purchaseRestockQty = 10;
      currentStock += purchaseRestockQty;
      expect(currentStock).toBe(32);

      const manualAdjustment = -2; // damaged goods
      currentStock += manualAdjustment;
      expect(currentStock).toBe(30);
    });

    it('identifies low stock thresholds', () => {
      const product = {
        quantity_on_hand: 3,
        low_stock_threshold: 5,
      };

      const isLowStock = product.quantity_on_hand <= product.low_stock_threshold;
      expect(isLowStock).toBe(true);
    });
  });
});
