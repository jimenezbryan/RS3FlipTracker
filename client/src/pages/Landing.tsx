import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  LineChart
} from "lucide-react";

function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />
      
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-success/20 rounded-full blur-[128px] animate-orb-float" />
      <div className="absolute top-1/2 -right-32 w-80 h-80 bg-blue-500/15 rounded-full blur-[100px] animate-orb-float-delayed" />
      <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] animate-orb-pulse" />
      <div className="absolute top-3/4 right-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-[90px] animate-orb-float-slow" />
      
      <div className="absolute inset-0">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-twinkle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
              opacity: 0.1 + Math.random() * 0.4,
            }}
          />
        ))}
      </div>
      
      <svg className="absolute inset-0 w-full h-full opacity-[0.15]" xmlns="http://www.w3.org/2000/svg">
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
      
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full animate-grid-pulse" 
           style={{ 
             background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)',
           }} 
      />
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f1419] via-[#131a22] to-[#0f1419] text-foreground relative">
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
        @keyframes grid-pulse {
          0%, 100% { opacity: 0.3; transform: translate(-50%, 0) scale(1); }
          50% { opacity: 0.6; transform: translate(-50%, 0) scale(1.1); }
        }
        .animate-orb-float { animation: orb-float 20s ease-in-out infinite; }
        .animate-orb-float-delayed { animation: orb-float-delayed 25s ease-in-out infinite; }
        .animate-orb-float-slow { animation: orb-float-slow 30s ease-in-out infinite; }
        .animate-orb-pulse { animation: orb-pulse 8s ease-in-out infinite; }
        .animate-twinkle { animation: twinkle 3s ease-in-out infinite; }
        .animate-grid-pulse { animation: grid-pulse 6s ease-in-out infinite; }
      `}</style>
      
      <AnimatedBackground />
      
      <header className="border-b border-border/40 backdrop-blur-sm bg-[#0f1419]/80 sticky top-0 z-50 relative">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GPStackLogo size={36} />
            <span className="text-xl font-bold text-white">FlipSync</span>
          </div>
          <Button variant="default" asChild data-testid="button-login">
            <a href="/api/login" className="flex items-center gap-2">
              Sign In
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </header>

      <main className="relative">
        <section className="relative mx-auto max-w-7xl px-4 py-24 sm:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 border border-success/20 text-success text-sm font-medium mb-8">
              <Zap className="h-4 w-4" />
              Live GE price tracking
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-b from-white via-white to-gray-400 bg-clip-text text-transparent leading-tight">
              Master the Grand Exchange
            </h1>
            
            <p className="text-xl sm:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
              Track flips, analyze profits, and optimize your trading strategy with 
              <span className="text-success font-medium"> AI-powered insights</span> and live RS3 market data.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Button size="lg" className="text-lg px-8 py-6 h-auto" asChild data-testid="button-get-started">
                <a href="/api/login" className="flex items-center gap-2">
                  Start Tracking Free
                  <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Shield className="h-4 w-4" />
                <span>Free forever. No credit card required.</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto text-center">
              <div>
                <div className="text-3xl sm:text-4xl font-bold text-success font-mono">1.5B+</div>
                <div className="text-sm text-muted-foreground mt-1">GP Tracked</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-bold text-white font-mono">500+</div>
                <div className="text-sm text-muted-foreground mt-1">Active Traders</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-bold text-white font-mono">10K+</div>
                <div className="text-sm text-muted-foreground mt-1">Flips Logged</div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-4 py-16">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything you need to flip smarter
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From profit tracking to AI recommendations, FlipSync gives you the edge in the Grand Exchange.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="bg-[#1a2332]/80 border-border/50 p-6 hover-elevate transition-all duration-300 backdrop-blur-sm">
              <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center mb-4">
                <DollarSign className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Profit Tracking</h3>
              <p className="text-muted-foreground">
                Log buys and sells, auto-calculate profits with 2% GE tax included. See your total gains at a glance.
              </p>
            </Card>

            <Card className="bg-[#1a2332]/80 border-border/50 p-6 hover-elevate transition-all duration-300 backdrop-blur-sm">
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                <LineChart className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Price Charts</h3>
              <p className="text-muted-foreground">
                View 90-day price history with your trades overlaid. Identify patterns and optimize timing.
              </p>
            </Card>

            <Card className="bg-[#1a2332]/80 border-border/50 p-6 hover-elevate transition-all duration-300 backdrop-blur-sm">
              <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">AI Recommendations</h3>
              <p className="text-muted-foreground">
                Get personalized trade suggestions based on your history, strategy, and past performance.
              </p>
            </Card>

            <Card className="bg-[#1a2332]/80 border-border/50 p-6 hover-elevate transition-all duration-300 backdrop-blur-sm">
              <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center mb-4">
                <Target className="h-6 w-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Profit Goals</h3>
              <p className="text-muted-foreground">
                Set daily, weekly, and monthly targets. Track your progress with visual indicators.
              </p>
            </Card>

            <Card className="bg-[#1a2332]/80 border-border/50 p-6 hover-elevate transition-all duration-300 backdrop-blur-sm">
              <div className="h-12 w-12 rounded-lg bg-rose-500/10 flex items-center justify-center mb-4">
                <Bell className="h-6 w-6 text-rose-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Price Alerts</h3>
              <p className="text-muted-foreground">
                Get browser notifications when items hit your target prices. Never miss an opportunity.
              </p>
            </Card>

            <Card className="bg-[#1a2332]/80 border-border/50 p-6 hover-elevate transition-all duration-300 backdrop-blur-sm">
              <div className="h-12 w-12 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Strategy Analytics</h3>
              <p className="text-muted-foreground">
                Compare performance across strategies. See which approach yields the best ROI.
              </p>
            </Card>
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-4 py-16">
          <Card className="bg-gradient-to-r from-[#1a2332] to-[#1e2a3a] border-border/50 p-8 sm:p-12 backdrop-blur-sm">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="text-center lg:text-left">
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                  Ready to maximize your profits?
                </h2>
                <p className="text-lg text-muted-foreground max-w-xl">
                  Join hundreds of traders already using FlipSync to track their Grand Exchange success.
                </p>
              </div>
              <Button size="lg" className="text-lg px-8 py-6 h-auto whitespace-nowrap" asChild>
                <a href="/api/login" className="flex items-center gap-2">
                  Get Started Now
                  <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
            </div>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border/40 bg-[#0f1419]/80 py-8 relative">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <GPStackLogo size={28} />
            <span className="font-semibold text-white">FlipSync</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Track your Grand Exchange profits with confidence
          </div>
        </div>
      </footer>
    </div>
  );
}
