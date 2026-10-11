import { Link } from 'react-router-dom';
import {
  Store,
  Bot,
  BarChart3,
  Wallet,
  Shield,
  ArrowRight,
  Package,
  FileText,
  Zap,
} from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900">
              <Store className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-slate-900">MerchantAI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            >
              Get started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-medium text-blue-700 mb-6">
                <Zap className="h-3 w-3" />
                AI-Powered Business OS
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
                Run your entire business with{' '}
                <span className="text-blue-600">natural language</span>
              </h1>
              <p className="mt-5 text-lg text-slate-600 leading-relaxed">
                MerchantAI lets small businesses manage sales, inventory, customers, invoices,
                and payments through a beautiful dashboard or simple conversational commands.
                Just tell it what happened — it handles the rest.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
                >
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Sign in
                </Link>
              </div>
              <p className="mt-4 text-xs text-slate-400">
                No credit card required. Works in demo mode without any API keys.
              </p>
            </div>

            {/* Mock dashboard preview */}
            <div className="relative">
              <div className="rounded-2xl border border-slate-200 shadow-xl overflow-hidden bg-slate-50">
                <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-400" />
                    <div className="h-3 w-3 rounded-full bg-amber-400" />
                    <div className="h-3 w-3 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-xs text-slate-400 ml-2">MerchantAI Dashboard</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Sales Today', value: 'PKR 85K', color: 'text-emerald-600' },
                      { label: 'Receivables', value: 'PKR 45K', color: 'text-blue-600' },
                      { label: 'Inventory', value: 'PKR 320K', color: 'text-slate-700' },
                    ].map((card) => (
                      <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-xs text-slate-500">{card.label}</p>
                        <p className={`text-sm font-bold mt-1 ${card.color}`}>{card.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-medium text-slate-700">AI Assistant</span>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
                      "Aaj Ahmed ko 2 iPhones 500,000 rupees mein sell kiye, usne 200,000 pay kiye."
                    </div>
                    <div className="rounded-lg bg-blue-50 p-2.5 text-xs text-blue-700 mt-2">
                      Got it. I'll record a sale of 2 iPhones to Ahmed for PKR 500,000 with PKR 200,000 paid and PKR 300,000 on credit. Shall I proceed?
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-100 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-bold text-slate-900 text-center">Everything you need to run your business</h2>
          <p className="mt-3 text-slate-600 text-center max-w-2xl mx-auto">
            From inventory to invoicing, from sales to Solana payments — MerchantAI brings it all together.
          </p>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              { icon: Bot, title: 'Natural Language Entry', desc: 'Record sales, purchases, and expenses by describing them in plain English or Roman Urdu.' },
              { icon: Package, title: 'Smart Inventory', desc: 'Track stock levels, get low-stock alerts, and maintain a full audit trail of every movement.' },
              { icon: BarChart3, title: 'Real-time Reports', desc: 'Dashboard with live sales, profit, expenses, receivables, and payables from your actual data.' },
              { icon: FileText, title: 'Professional Invoicing', desc: 'Create, issue, and track invoices with payment history and due-date reminders.' },
              { icon: Wallet, title: 'Solana Payments', desc: 'Accept test payments on Solana Devnet with on-chain verification and clear demo labeling.' },
              { icon: Shield, title: 'Secure & Isolated', desc: 'Row-level security ensures each business sees only its own data. No secrets exposed.' },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                  <f.icon className="h-5 w-5 text-slate-700" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-100 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold text-slate-900">Ready to get started?</h2>
          <p className="mt-3 text-slate-600">
            Create your free account and start managing your business in minutes.
          </p>
          <Link
            to="/register"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-8 py-3 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
          >
            Create your account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto max-w-6xl px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-slate-400" />
            <span className="text-sm text-slate-500">MerchantAI</span>
          </div>
          <p className="text-xs text-slate-400">AI-Powered Business Operating System</p>
        </div>
      </footer>
    </div>
  );
}
