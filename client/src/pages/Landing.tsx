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

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f1419] via-[#131a22] to-[#0f1419] text-foreground">
      <header className="border-b border-border/40 backdrop-blur-sm bg-[#0f1419]/80 sticky top-0 z-50">
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

      <main className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(59,130,246,0.05),transparent_50%)]" />
        
        <section className="relative mx-auto max-w-7xl px-4 py-24 sm:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 border border-success/20 text-success text-sm font-medium mb-8">
              <Zap className="h-4 w-4" />
              Real-time GE price tracking
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-b from-white via-white to-gray-400 bg-clip-text text-transparent leading-tight">
              Master the Grand Exchange
            </h1>
            
            <p className="text-xl sm:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
              Track flips, analyze profits, and optimize your trading strategy with 
              <span className="text-success font-medium"> AI-powered insights</span> and real-time RS3 market data.
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
            <Card className="bg-[#1a2332]/80 border-border/50 p-6 hover-elevate transition-all duration-300">
              <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center mb-4">
                <DollarSign className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Profit Tracking</h3>
              <p className="text-muted-foreground">
                Log buys and sells, auto-calculate profits with 2% GE tax included. See your total gains at a glance.
              </p>
            </Card>

            <Card className="bg-[#1a2332]/80 border-border/50 p-6 hover-elevate transition-all duration-300">
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                <LineChart className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Price Charts</h3>
              <p className="text-muted-foreground">
                View 90-day price history with your trades overlaid. Identify patterns and optimize timing.
              </p>
            </Card>

            <Card className="bg-[#1a2332]/80 border-border/50 p-6 hover-elevate transition-all duration-300">
              <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">AI Recommendations</h3>
              <p className="text-muted-foreground">
                Get personalized trade suggestions based on your history, strategy, and past performance.
              </p>
            </Card>

            <Card className="bg-[#1a2332]/80 border-border/50 p-6 hover-elevate transition-all duration-300">
              <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center mb-4">
                <Target className="h-6 w-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Profit Goals</h3>
              <p className="text-muted-foreground">
                Set daily, weekly, and monthly targets. Track your progress with visual indicators.
              </p>
            </Card>

            <Card className="bg-[#1a2332]/80 border-border/50 p-6 hover-elevate transition-all duration-300">
              <div className="h-12 w-12 rounded-lg bg-rose-500/10 flex items-center justify-center mb-4">
                <Bell className="h-6 w-6 text-rose-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Price Alerts</h3>
              <p className="text-muted-foreground">
                Get browser notifications when items hit your target prices. Never miss an opportunity.
              </p>
            </Card>

            <Card className="bg-[#1a2332]/80 border-border/50 p-6 hover-elevate transition-all duration-300">
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
          <Card className="bg-gradient-to-r from-[#1a2332] to-[#1e2a3a] border-border/50 p-8 sm:p-12">
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

      <footer className="border-t border-border/40 bg-[#0f1419]/80 py-8">
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
