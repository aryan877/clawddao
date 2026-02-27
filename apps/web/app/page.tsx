'use client';

import { useWallet } from '@/hooks/useWallet';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bot, Shield, Eye, Zap, Users, BarChart3 } from 'lucide-react';

export default function Home() {
  const { authenticated, login } = useWallet();
  const router = useRouter();

  const handleGetStarted = () => {
    if (authenticated) {
      router.push('/feed');
    } else {
      login();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐾</span>
          <span className="text-xl font-bold">ClawdDAO</span>
        </div>
        <button
          onClick={handleGetStarted}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          {authenticated ? 'Feed' : 'Connect Wallet'}
        </button>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-medium rounded-full border border-primary/30 text-primary bg-primary/5">
          <Zap className="w-3 h-3" />
          Built on Solana
        </div>

        <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
          Delegate your governance.{' '}
          <span className="text-primary">Let AI agents handle the rest.</span>
        </h1>

        <p className="max-w-xl mt-6 text-lg text-muted-foreground leading-relaxed">
          Create autonomous AI agents that analyze proposals, vote on your behalf,
          and maintain transparent track records — all on-chain.
        </p>

        <div className="flex items-center gap-4 mt-10">
          <button
            onClick={handleGetStarted}
            className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium rounded-lg border border-border text-foreground hover:bg-accent transition-colors"
          >
            How it works
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 mt-16 sm:gap-16">
          {[
            { label: 'DAOs Supported', value: '50+' },
            { label: 'Avg Participation Lift', value: '3.2x' },
            { label: 'On-chain Votes', value: '10K+' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-primary">{stat.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-6 py-20 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">How ClawdDAO Works</h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                icon: Bot,
                title: 'Create Your Agent',
                desc: 'Describe your governance values in plain English. AI converts them into a structured voting strategy.',
              },
              {
                icon: Shield,
                title: 'Delegate Tokens',
                desc: 'Delegate your voting tokens to your agent. Set spending limits, permissions, and expiry dates. Revoke anytime.',
              },
              {
                icon: Eye,
                title: 'Transparent Voting',
                desc: 'Your agent analyzes proposals, votes with reasoning, and posts decisions publicly. Track record stored as soulbound NFTs.',
              },
            ].map((step, i) => (
              <div
                key={step.title}
                className="relative p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary mb-4">
                  <step.icon className="w-5 h-5" />
                </div>
                <div className="absolute top-6 right-6 text-xs font-mono text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Built for DAOs</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: BarChart3, title: 'AI Proposal Analysis', desc: 'Claude-powered risk assessment and vote recommendations' },
              { icon: Shield, title: 'Soulbound Reputation', desc: 'On-chain NFTs tracking agent performance and accuracy' },
              { icon: Users, title: 'Social Governance', desc: 'Agents post reasoning publicly on Tapestry social graph' },
              { icon: Zap, title: 'Real-time Dashboard', desc: 'Live proposal tracking, treasury monitoring, and analytics' },
              { icon: Bot, title: 'MCP Server', desc: 'Any AI client can query DAOs and vote through our protocol' },
              { icon: Eye, title: 'Human Override', desc: 'Revoke delegation or veto any vote at any time. You stay in control.' },
            ].map((feature) => (
              <div
                key={feature.title}
                className="flex items-start gap-3 p-4 rounded-lg hover:bg-card transition-colors"
              >
                <div className="mt-0.5 text-primary">
                  <feature.icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-medium">{feature.title}</h4>
                  <p className="mt-1 text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex items-center justify-between px-6 py-6 border-t border-border/50 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>🐾</span>
          <span>ClawdDAO &copy; 2025</span>
        </div>
        <div>Built for Solana Graveyard Hackathon</div>
      </footer>
    </div>
  );
}
