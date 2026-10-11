import { describe, it, expect } from 'vitest';
import { parseIntent } from '@/pages/assistant';

describe('AI Assistant Intent Parser', () => {
  it('parses English sale command with customer and payment info', () => {
    const input = "Sell 2 iPhones to Ahmed for 500000, paid 200000";
    const res = parseIntent(input);

    expect(res.transaction_type).toBe('sale');
    expect(res.customer_name).toBe('Ahmed');
    expect(res.products).toHaveLength(1);
    expect(res.products[0].name.toLowerCase()).toContain('iphone');
    expect(res.products[0].quantity).toBe(2);
    expect(res.total_amount).toBe(500000);
    expect(res.amount_paid).toBe(200000);
    expect(res.summary.toLowerCase()).toContain('sale');
  });

  it('parses Roman Urdu sale command', () => {
    const input = "Aaj Ahmed ko 2 iPhones 500000 rupees mein sell kiye, usne 200000 pay kiye";
    const res = parseIntent(input);

    expect(res.transaction_type).toBe('sale');
    expect(res.products.length).toBeGreaterThan(0);
    expect(res.total_amount).toBe(500000);
    expect(res.amount_paid).toBe(200000);
  });

  it('parses purchase command from supplier', () => {
    const input = "Bought 10 chargers from Tech Distributors for 25000";
    const res = parseIntent(input);

    expect(res.transaction_type).toBe('purchase');
    expect(res.supplier_name).toBe('Tech Distributors');
    expect(res.products[0].name.toLowerCase()).toContain('charger');
    expect(res.products[0].quantity).toBe(10);
    expect(res.total_amount).toBe(25000);
  });

  it('parses operating expense command', () => {
    const input = "Record an expense of 5000 for electricity bill";
    const res = parseIntent(input);

    expect(res.transaction_type).toBe('expense');
    expect(res.total_amount).toBe(5000);
    expect(res.summary.toLowerCase()).toContain('expense');
  });

  it('identifies question intents correctly', () => {
    expect(parseIntent("How much did I sell today?").intent).toBe('ask_sales_summary');
    expect(parseIntent("Which products are low in stock?").intent).toBe('ask_low_stock');
    expect(parseIntent("What is my gross profit this month?").intent).toBe('ask_gross_profit');
    expect(parseIntent("Who owes me money?").intent).toBe('ask_receivables');
    expect(parseIntent("How much do I owe my suppliers?").intent).toBe('ask_payables');
    expect(parseIntent("What are my top selling products?").intent).toBe('ask_top_products');
  });

  it('records missing fields and warnings for incomplete sale intent', () => {
    const incomplete = "Sell iPhone";
    const res = parseIntent(incomplete);

    expect(res.transaction_type).toBe('sale');
    expect(res.missing_fields.length).toBeGreaterThan(0);
  });

  it('handles unknown input gracefully', () => {
    const res = parseIntent("asdfghjkl random string");
    expect(res.intent).toBe('unknown');
    expect(res.summary).toContain("couldn't understand");
  });
});
