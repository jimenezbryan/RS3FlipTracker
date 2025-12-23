import { Header } from "@/components/Header";
import { AIRecommendations } from "@/components/AIRecommendations";
import { useLocation } from "wouter";

export default function Suggestions() {
  const [, setLocation] = useLocation();

  const handleSelectItem = (item: { name: string; id: number; price: number }) => {
    setLocation(`/?item=${encodeURIComponent(item.name)}&itemId=${item.id}&price=${item.price}`);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="page-suggestions">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">AI-Powered Suggestions</h1>
          <p className="text-muted-foreground mt-1">
            Personalized item recommendations based on your trading history and patterns
          </p>
        </div>
        
        <AIRecommendations onSelectItem={handleSelectItem} />
      </main>
    </div>
  );
}
