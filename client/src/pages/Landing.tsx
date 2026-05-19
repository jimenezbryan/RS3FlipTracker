import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GPStackLogo } from "@/components/GPStackLogo";
import { 
  TrendingUp, 
  DollarSign, 
  BarChart3, 
  Target, 
  Sparkles, 
  Bell,
  ArrowRight,
  Zap,
  Shield,
  LineChart,
  PieChart,
  Activity,
  Users,
  BookOpen,
  ChevronRight,
  Calculator,
  Brain,
  Layers,
  MessageSquare,
  Globe,
  Crosshair,
  Percent
} from "lucide-react";
import dashboardPreview from "@assets/image_1768017836449.png";

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e14] via-[#0f1419] to-[#0a0e14] flex items-center justify-center">
      <div className="text-center space-y-6 animate-pulse">
        <div className="w-16 h-16 rounded-xl bg-success/20 mx-auto animate-logo-glow" />
        <div className="h-8 w-48 bg-white/10 rounded-lg mx-auto" />
        <div className="flex gap-2 justify-center">
          <div className="h-2 w-2 bg-success/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="h-2 w-2 bg-success/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="h-2 w-2 bg-success/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-success/15 rounded-full blur-[128px] animate-orb-float" />
      <div className="absolute top-1/2 -right-32 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] animate-orb-float-delayed" />
      <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-purple-500/8 rounded-full blur-[80px] animate-orb-pulse" />
      <div className="absolute top-3/4 right-1/4 w-72 h-72 bg-cyan-500/8 rounded-full blur-[90px] animate-orb-float-slow" />
      
      <div className="absolute inset-0">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-twinkle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
              opacity: 0.1 + Math.random() * 0.3,
            }}
          />
        ))}
      </div>
      
      <svg className="absolute inset-0 w-full h-full opacity-[0.08]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border" />
          </pattern>
          <radialGradient id="grid-fade" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="grid-mask">
            <rect width="100%" height="100%" fill="url(#grid-fade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" mask="url(#grid-mask)" />
      </svg>
    </div>
  );
}

const metrics = [
  {
    icon: DollarSign,
    label: "Profit / Loss",
    description: "Per-flip and cumulative P&L with accurate GE tax calculation",
    color: "text-success",
    bgColor: "bg-success/10",
  },
  {
    icon: Percent,
    label: "ROI",
    description: "Return on investment per flip, per strategy, and overall",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: Target,
    label: "Win Rate",
    description: "Track how often your trades are profitable with rolling trends",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
  },
  {
    icon: Activity,
    label: "Hold Time",
    description: "Average time between buy and sell to optimize flip speed",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
  },
  {
    icon: PieChart,
    label: "Portfolio Value",
    description: "Total investment, unrealized gains, and allocation breakdown",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
  {
    icon: TrendingUp,
    label: "Equity Curve",
    description: "Cumulative profit growth over time with historical charts",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
  },
];

const features = [
  {
    icon: Calculator,
    title: "Flip Logging & Tax Calc",
    description: "Log buys and sells with auto GE tax (2%, no cap). Item autocomplete with live prices, membership status, and GE limits.",
  },
  {
    icon: LineChart,
    title: "90-Day Price Charts",
    description: "View historical price trends with your actual trades overlaid. Spot patterns and time your entries.",
  },
  {
    icon: Brain,
    title: "AI-Powered Insights",
    description: "Get personalized item recommendations and smart buy/sell price suggestions based on your trading history.",
  },
  {
    icon: BarChart3,
    title: "Strategy Analytics",
    description: "Tag flips by strategy (Fast Flip, Bulk, High Margin, etc.) and compare performance across each approach.",
  },
  {
    icon: Bell,
    title: "Price Alerts & Notifications",
    description: "Set price targets and get browser push notifications when items hit your buy or sell zones.",
  },
  {
    icon: Layers,
    title: "Recipe Crafting Tracker",
    description: "Track multi-component crafts across RS accounts. Log component buys, track progress, and calculate crafting profit.",
  },
  {
    icon: BookOpen,
    title: "Trading Journal",
    description: "Calendar heat map of daily trades with trade replay timeline. Review every buy and sell in chronological order.",
  },
  {
    icon: Globe,
    title: "Market Movers",
    description: "Live dashboard showing top gainers, losers, and most active items with 24h/7d price changes and sparklines.",
  },
  {
    icon: Crosshair,
    title: "Trading Terminal (Scanner)",
    description: "Wall Street-level analytics with composite Trade Score, momentum indicators, volume analysis, and risk/reward signals.",
  },
  {
    icon: MessageSquare,
    title: "Discord Integration",
    description: "Push daily trading summaries to Discord. Net P&L, trade count, win rate, and best/worst trades at a glance.",
  },
  {
    icon: Target,
    title: "Profit Goals",
    description: "Set daily, weekly, and monthly profit targets. Visual progress bars keep you accountable.",
  },
  {
    icon: Sparkles,
    title: "Portfolio Management",
    description: "Full portfolio tracking with categories, snapshots, transaction history, and weighted average cost basis.",
  },
];

const audiences = [
  {
    title: "GE Flippers",
    description: "You buy low, sell high on the Grand Exchange. You want to know exactly how much you're making after tax and which items are your best performers.",
    gradient: "from-success/20 to-success/5",
    borderColor: "border-success/30",
    icon: DollarSign,
    iconColor: "text-success",
  },
  {
    title: "Bulk Merchers",
    description: "You move thousands of items at tight margins. You need volume tracking, hold time analytics, and strategy tagging to optimize your operations.",
    gradient: "from-blue-500/20 to-blue-500/5",
    borderColor: "border-blue-500/30",
    icon: Layers,
    iconColor: "text-blue-400",
  },
  {
    title: "Long-Term Investors",
    description: "You hold items for days or weeks waiting for price movements. Portfolio snapshots, equity curves, and price alerts are your best friends.",
    gradient: "from-purple-500/20 to-purple-500/5",
    borderColor: "border-purple-500/30",
    icon: TrendingUp,
    iconColor: "text-purple-400",
  },
  {
    title: "Set Crafters",
    description: "You assemble multi-component items for profit. Track component purchases across RS accounts, monitor progress, and calculate crafting margins.",
    gradient: "from-amber-500/20 to-amber-500/5",
    borderColor: "border-amber-500/30",
    icon: Target,
    iconColor: "text-amber-400",
  },
];

function smoothScrollTo(elementId: string) {
  const element = document.getElementById(elementId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export default function Landing() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e14] via-[#0f1419] to-[#0a0e14] text-foreground relative">
      <style>{`
        @keyframes orb-float {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(-10px) translateX(-10px); }
          75% { transform: translateY(-30px) translateX(5px); }
        }
        @keyframes orb-float-delayed {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(15px) translateX(-15px); }
          50% { transform: translateY(-20px) translateX(10px); }
          75% { transform: translateY(10px) translateX(-5px); }
        }
        @keyframes orb-float-slow {
          0%, 100% { transform: translateY(0) translateX(0) scale(1); }
          50% { transform: translateY(-40px) translateX(20px) scale(1.1); }
        }
        @keyframes orb-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.2); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.1; transform: scale(0.8); }
          50% { opacity: 0.8; transform: scale(1.2); }
        }
        @keyframes logo-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.3), 0 0 40px rgba(34, 197, 94, 0.1); }
          50% { box-shadow: 0 0 30px rgba(34, 197, 94, 0.5), 0 0 60px rgba(34, 197, 94, 0.2); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-orb-float { animation: orb-float 20s ease-in-out infinite; }
        .animate-orb-float-delayed { animation: orb-float-delayed 25s ease-in-out infinite; }
        .animate-orb-float-slow { animation: orb-float-slow 30s ease-in-out infinite; }
        .animate-orb-pulse { animation: orb-pulse 8s ease-in-out infinite; }
        .animate-twinkle { animation: twinkle 3s ease-in-out infinite; }
        .animate-logo-glow { animation: logo-glow 3s ease-in-out infinite; }
        .animate-fade-up { animation: fade-up 0.6s ease-out forwards; }
        .animate-fade-up-delay-1 { animation: fade-up 0.6s ease-out 0.1s forwards; opacity: 0; }
        .animate-fade-up-delay-2 { animation: fade-up 0.6s ease-out 0.2s forwards; opacity: 0; }
        .animate-fade-up-delay-3 { animation: fade-up 0.6s ease-out 0.3s forwards; opacity: 0; }
        html { scroll-behavior: smooth; }
      `}</style>
      
      <AnimatedBackground />
      
      <header className="border-b border-border/30 backdrop-blur-md bg-[#0a0e14]/70 sticky top-0 z-50 relative">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="animate-logo-glow rounded-lg">
              <GPStackLogo size={32} />
            </div>
            <span className="text-lg font-bold text-white">FlipSync</span>
            <Badge variant="secondary" className="text-[10px] font-mono tracking-wider uppercase">Beta</Badge>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => smoothScrollTo('what-it-does')} 
              className="text-sm text-muted-foreground hover:text-white transition-colors"
              data-testid="nav-what-it-does"
            >
              Features
            </button>
            <button 
              onClick={() => smoothScrollTo('metrics')} 
              className="text-sm text-muted-foreground hover:text-white transition-colors"
              data-testid="nav-metrics"
            >
              Metrics
            </button>
            <button 
              onClick={() => smoothScrollTo('who-its-for')} 
              className="text-sm text-muted-foreground hover:text-white transition-colors"
              data-testid="nav-who-its-for"
            >
              Who It's For
            </button>
          </nav>
          <Button variant="default" asChild data-testid="button-login">
            <a href="/auth" className="flex items-center gap-2">
              Sign In
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </header>

      <main className="relative">
        {/* HERO */}
        <section className="relative mx-auto max-w-7xl px-4 pt-20 pb-16 sm:pt-28 sm:pb-24">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 border border-success/20 text-success text-sm font-medium mb-8 animate-fade-up">
              <Zap className="h-4 w-4" />
              Real-time GE price tracking & analytics
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-b from-white via-white to-gray-500 bg-clip-text text-transparent leading-tight animate-fade-up-delay-1">
              Your RS3 Grand Exchange
              <br />
              <span className="bg-gradient-to-r from-success via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Trading Edge
              </span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed animate-fade-up-delay-2">
              FlipSync tracks every flip, calculates profit after GE tax, and gives you AI-powered insights to find your next winning trade. Built by RS3 merchers, for RS3 merchers.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16 animate-fade-up-delay-3">
              <Button size="lg" className="text-base px-8" asChild data-testid="button-apply-beta">
                <a href="/auth" className="flex items-center gap-2">
                  Apply for Beta Access
                  <ChevronRight className="h-5 w-5" />
                </a>
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 backdrop-blur-sm" asChild data-testid="button-dm-x">
                <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  DM on X
                </a>
              </Button>
            </div>

            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mb-4">
              <Shield className="h-4 w-4" />
              <span>Free during beta. No credit card required.</span>
            </div>
          </div>
        </section>

        {/* DASHBOARD PREVIEW */}
        <section className="relative mx-auto max-w-6xl px-4 pb-20">
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-success/20 via-blue-500/15 to-purple-500/20 rounded-2xl blur-2xl opacity-40" />
            <Card className="relative bg-[#131a22]/90 border-border/40 p-2 overflow-hidden backdrop-blur-sm">
              <img 
                src={dashboardPreview} 
                alt="FlipSync Dashboard" 
                className="w-full rounded-lg"
                data-testid="img-dashboard-preview"
              />
            </Card>
          </div>
        </section>

        {/* WHAT IT DOES */}
        <section id="what-it-does" className="relative mx-auto max-w-7xl px-4 py-20">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 text-xs font-mono tracking-wider uppercase">What FlipSync Does</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything you need to flip smarter
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From logging your first flip to running a full trading operation, FlipSync covers every angle.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="bg-[#131a22]/80 border-border/30 p-5 hover-elevate transition-all duration-300 backdrop-blur-sm group"
                data-testid={`feature-card-${index}`}
              >
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-white/10 transition-colors">
                    <feature.icon className="h-5 w-5 text-muted-foreground group-hover:text-white transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* KEY METRICS */}
        <section id="metrics" className="relative mx-auto max-w-7xl px-4 py-20">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 text-xs font-mono tracking-wider uppercase">Key Metrics</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Numbers that matter
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              FlipSync tracks the metrics that actually help you make better trading decisions.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {metrics.map((metric, index) => (
              <div 
                key={index}
                className="relative group"
                data-testid={`metric-card-${index}`}
              >
                <Card className="bg-[#131a22]/80 border-border/30 p-6 backdrop-blur-sm h-full hover-elevate transition-all duration-300">
                  <div className={`h-12 w-12 rounded-xl ${metric.bgColor} flex items-center justify-center mb-4`}>
                    <metric.icon className={`h-6 w-6 ${metric.color}`} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2 font-mono">{metric.label}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{metric.description}</p>
                </Card>
              </div>
            ))}
          </div>

          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-4xl mx-auto text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-success font-mono">2%</div>
              <div className="text-sm text-muted-foreground mt-1">GE Tax Accuracy</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-white font-mono">90d</div>
              <div className="text-sm text-muted-foreground mt-1">Price History</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-white font-mono">6</div>
              <div className="text-sm text-muted-foreground mt-1">Strategy Types</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-white font-mono">0-100</div>
              <div className="text-sm text-muted-foreground mt-1">Trade Score</div>
            </div>
          </div>
        </section>

        {/* WHO IT'S FOR */}
        <section id="who-its-for" className="relative mx-auto max-w-7xl px-4 py-20">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 text-xs font-mono tracking-wider uppercase">Who It's For</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Built for serious RS3 traders
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Whether you flip for fun or run a merching empire, FlipSync scales with your ambitions.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 max-w-5xl mx-auto">
            {audiences.map((audience, index) => (
              <Card 
                key={index}
                className={`bg-gradient-to-br ${audience.gradient} border ${audience.borderColor} p-6 backdrop-blur-sm hover-elevate transition-all duration-300`}
                data-testid={`audience-card-${index}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                    <audience.icon className={`h-5 w-5 ${audience.iconColor}`} />
                  </div>
                  <h3 className="text-xl font-bold text-white">{audience.title}</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">{audience.description}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="relative mx-auto max-w-7xl px-4 py-20">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 text-xs font-mono tracking-wider uppercase">How It Works</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Start tracking in under a minute
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
            {[
              { step: 1, title: "Sign In", desc: "Log in with your email, Google, Discord, or Replit account. Takes seconds.", color: "text-success", borderColor: "border-success/40" },
              { step: 2, title: "Log Flips", desc: "Search any GE item, enter buy/sell prices. Tax and profit calculated automatically.", color: "text-blue-400", borderColor: "border-blue-500/40" },
              { step: 3, title: "Analyze & Grow", desc: "Review stats, set goals, get AI tips, and watch your equity curve climb.", color: "text-purple-400", borderColor: "border-purple-500/40" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className={`w-14 h-14 rounded-full border-2 ${item.borderColor} bg-[#131a22] flex items-center justify-center mx-auto mb-5`}>
                  <span className={`text-xl font-bold font-mono ${item.color}`}>{item.step}</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="relative mx-auto max-w-7xl px-4 py-16 pb-24">
          <Card className="bg-gradient-to-br from-[#131a22] via-[#162030] to-[#131a22] border-border/30 p-10 sm:p-14 backdrop-blur-sm text-center relative overflow-visible">
            <div className="absolute -top-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-success/50 to-transparent" />
            
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to track your profits?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              FlipSync is currently in closed beta. Apply now to get early access and help shape the future of RS3 trading tools.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6">
              <Button size="lg" className="text-base px-8" asChild data-testid="button-apply-beta-footer">
                <a href="/auth" className="flex items-center gap-2">
                  Apply for Beta Access
                  <ChevronRight className="h-5 w-5" />
                </a>
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 backdrop-blur-sm" asChild data-testid="button-dm-x-footer">
                <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  DM on X
                </a>
              </Button>
            </div>
            
            <div className="flex items-center justify-center gap-4 flex-wrap text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-success" />
                Free during beta
              </span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-blue-400" />
                Limited spots
              </span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                Instant setup
              </span>
            </div>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border/30 bg-[#0a0e14]/80 py-8 relative">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <GPStackLogo size={24} />
            <span className="font-semibold text-white text-sm">FlipSync</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Built for the RS3 trading community
          </div>
        </div>
      </footer>
    </div>
  );
}
