import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, 
  TrendingUp, 
  TrendingDown,
  Target, 
  Clock, 
  AlertTriangle, 
  Sparkles,
  RefreshCw,
  ChevronRight,
  Shield,
  Zap,
  ArrowUpRight,
  Info
} from "lucide-react";
import { formatGp } from "@shared/taxCalculator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface UserTradingProfile {
  preferredStrategies: { strategy: string; frequency: number; avgROI: number; winRate: number }[];
  preferredPriceRange: { min: number; max: number };
  avgHoldTime: number;
  riskProfile: "conservative" | "moderate" | "aggressive";
  membershipPreference: "members" | "f2p" | "both";
  totalFlips: number;
  winRate: number;
  avgROI: number;
  topPerformingItems: { name: string; profit: number; roiPercent: number }[];
  frequentlyTradedItems: string[];
  tradingVolume: { daily: number; weekly: number; monthly: number };
}

interface PersonalizedRecommendation {
  itemName: string;
  itemId: number;
  itemIcon?: string;
  currentPrice: number;
  suggestedBuyPrice: number;
  suggestedSellPrice: number;
  potentialProfit: number;
  potentialROI: number;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  matchScore: number;
  matchReasons: string[];
  strategy: string;
  riskLevel: "low" | "medium" | "high";
  estimatedHoldTime: string;
}

interface RecommendationsResponse {
  recommendations: PersonalizedRecommendation[];
  profile: UserTradingProfile | null;
  message: string | null;
}

interface AIRecommendationsProps {
  onSelectItem?: (item: { name: string; id: number; price: number }) => void;
}

export function AIRecommendations({ onSelectItem }: AIRecommendationsProps) {
  const { data, isLoading, error, refetch, isFetching } = useQuery<RecommendationsResponse>({
    queryKey: ["/api/ai/recommendations"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <Card data-testid="card-ai-recommendations-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary animate-pulse" />
            Analyzing Your Trading Patterns...
          </CardTitle>
          <CardDescription>
            Our AI is reviewing your flip history to find personalized recommendations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 p-4 rounded-lg border">
              <Skeleton className="h-12 w-12 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="card-ai-recommendations-error">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Unable to Generate Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            We encountered an error analyzing your trading data. Please try again later.
          </p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => refetch()}
            data-testid="button-retry-recommendations"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.recommendations.length === 0) {
    return (
      <Card data-testid="card-ai-recommendations-empty">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI-Powered Suggestions
          </CardTitle>
          <CardDescription>
            {data?.message || "Complete more flips to unlock personalized recommendations"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">
              {data?.profile?.totalFlips !== undefined 
                ? `You have ${data.profile.totalFlips} completed flip${data.profile.totalFlips !== 1 ? 's' : ''}. Complete at least 3 flips to get personalized AI recommendations.`
                : "Log some flips to help our AI learn your trading style and provide personalized suggestions."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { recommendations, profile } = data;

  return (
    <div className="space-y-6" data-testid="container-ai-recommendations">
      {profile && (
        <Card data-testid="card-trading-profile">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-primary" />
                Your Trading Profile
              </CardTitle>
              <Badge variant={
                profile.riskProfile === "aggressive" ? "destructive" :
                profile.riskProfile === "conservative" ? "secondary" : "default"
              }>
                {profile.riskProfile.charAt(0).toUpperCase() + profile.riskProfile.slice(1)} Trader
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="text-center">
                <div className="text-2xl font-bold font-mono text-success">
                  {profile.winRate.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">Win Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold font-mono">
                  {profile.avgROI.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Avg ROI</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold font-mono">
                  {profile.totalFlips}
                </div>
                <div className="text-xs text-muted-foreground">Total Flips</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold font-mono">
                  {formatHoldTime(profile.avgHoldTime)}
                </div>
                <div className="text-xs text-muted-foreground">Avg Hold</div>
              </div>
            </div>
            
            {profile.preferredStrategies.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-xs text-muted-foreground mb-2">Preferred Strategies</div>
                <div className="flex flex-wrap gap-1">
                  {profile.preferredStrategies.slice(0, 3).map((s) => (
                    <Badge key={s.strategy} variant="outline" className="text-xs">
                      {s.strategy} ({s.frequency})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Recommendations
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-refresh-recommendations"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <CardDescription>
            Personalized item suggestions based on your trading history
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recommendations.map((rec, index) => (
            <div 
              key={`${rec.itemId}-${index}`}
              className="relative p-4 rounded-lg border hover-elevate cursor-pointer transition-all"
              onClick={() => onSelectItem?.({ name: rec.itemName, id: rec.itemId, price: rec.currentPrice })}
              data-testid={`card-recommendation-${rec.itemId}`}
            >
              <div className="flex gap-3">
                {rec.itemIcon && (
                  <img 
                    src={rec.itemIcon} 
                    alt={rec.itemName}
                    className="h-10 w-10 object-contain"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium truncate">{rec.itemName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            rec.confidence === "high" ? "border-success text-success" :
                            rec.confidence === "low" ? "border-destructive text-destructive" : ""
                          }`}
                        >
                          {rec.confidence} confidence
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {rec.strategy}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold font-mono text-success">
                        +{rec.potentialROI.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ~{formatGp(rec.potentialProfit)} profit
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <div className="text-muted-foreground">Buy at</div>
                      <div className="font-mono font-medium">{formatGp(rec.suggestedBuyPrice)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Sell at</div>
                      <div className="font-mono font-medium">{formatGp(rec.suggestedSellPrice)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Hold Time</div>
                      <div className="font-medium">{rec.estimatedHoldTime}</div>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground mb-1">Match Score</div>
                      <Progress value={rec.matchScore} className="h-1.5" />
                    </div>
                    <span className="text-xs font-medium">{rec.matchScore}%</span>
                  </div>
                  
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                    {rec.reasoning}
                  </p>
                  
                  {rec.matchReasons.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {rec.matchReasons.slice(0, 3).map((reason, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 self-center" />
              </div>
              
              <div className="absolute top-2 right-2">
                <Tooltip>
                  <TooltipTrigger>
                    <div className={`h-2 w-2 rounded-full ${
                      rec.riskLevel === "low" ? "bg-success" :
                      rec.riskLevel === "high" ? "bg-destructive" : "bg-warning"
                    }`} />
                  </TooltipTrigger>
                  <TooltipContent>
                    {rec.riskLevel.charAt(0).toUpperCase() + rec.riskLevel.slice(1)} Risk
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function formatHoldTime(ms: number): string {
  const hours = ms / 3600000;
  if (hours < 1) return "<1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  return `${Math.round(days)}d`;
}
