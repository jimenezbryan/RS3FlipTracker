import { useState, useRef } from "react";
import { Header } from "@/components/Header";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Recipe, RecipeWithComponents, RecipeRun, RecipeRunWithDetails, RsAccount } from "@shared/schema";
import { ItemIcon } from "@/components/ItemIcon";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  BookOpen, Plus, Trash2, Loader2, Play, CheckCircle2, 
  Package, ChevronRight
} from "lucide-react";
import { formatGP } from "@/lib/formatters";

interface GEItem {
  id: number;
  name: string;
  price: number;
  icon?: string;
}

interface ComponentInput {
  itemId?: number;
  itemName: string;
  itemIcon?: string;
  quantityRequired: number;
}

export default function Recipes() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("recipes");
  
  const [isCreateRecipeOpen, setIsCreateRecipeOpen] = useState(false);
  const [recipeName, setRecipeName] = useState("");
  const [outputItemName, setOutputItemName] = useState("");
  const [outputItemId, setOutputItemId] = useState<number | undefined>();
  const [outputItemIcon, setOutputItemIcon] = useState<string | undefined>();
  const [outputQuantity, setOutputQuantity] = useState("1");
  const [recipeNotes, setRecipeNotes] = useState("");
  const [components, setComponents] = useState<ComponentInput[]>([]);
  const [selectedOutputItem, setSelectedOutputItem] = useState<GEItem | null>(null);
  const [outputSuggestions, setOutputSuggestions] = useState<GEItem[]>([]);
  const [showOutputSuggestions, setShowOutputSuggestions] = useState(false);
  const [isSearchingOutput, setIsSearchingOutput] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [componentSearch, setComponentSearch] = useState("");
  const [componentSuggestions, setComponentSuggestions] = useState<GEItem[]>([]);
  const [showComponentSuggestions, setShowComponentSuggestions] = useState(false);
  const [isSearchingComponent, setIsSearchingComponent] = useState(false);
  const [componentQuantity, setComponentQuantity] = useState("1");

  const [isStartRunOpen, setIsStartRunOpen] = useState(false);
  const [selectedRecipeForRun, setSelectedRecipeForRun] = useState<RecipeWithComponents | null>(null);
  const [targetSellPrice, setTargetSellPrice] = useState("");

  const [selectedRun, setSelectedRun] = useState<RecipeRunWithDetails | null>(null);
  const [isLogComponentOpen, setIsLogComponentOpen] = useState(false);
  const [logComponentId, setLogComponentId] = useState("");
  const [logQuantity, setLogQuantity] = useState("");
  const [logBuyPrice, setLogBuyPrice] = useState("");
  const [logRsAccountId, setLogRsAccountId] = useState("");

  const [isCompleteRunOpen, setIsCompleteRunOpen] = useState(false);
  const [completeSellPrice, setCompleteSellPrice] = useState("");

  const { data: recipes = [], isLoading: isLoadingRecipes } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
  });

  const { data: runs = [], isLoading: isLoadingRuns } = useQuery<RecipeRun[]>({
    queryKey: ["/api/recipe-runs"],
  });

  const { data: rsAccounts = [] } = useQuery<RsAccount[]>({
    queryKey: ["/api/rs-accounts"],
  });

  const activeRuns = runs.filter(r => r.status === "gathering" || r.status === "ready");
  const completedRuns = runs.filter(r => r.status === "sold" || r.status === "crafted");

  const searchItems = async (query: string): Promise<GEItem[]> => {
    if (query.length < 2) return [];
    const response = await fetch(`/api/ge/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) return [];
    return response.json();
  };

  const handleOutputSearch = (value: string) => {
    setOutputItemName(value);
    setSelectedOutputItem(null);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (value.length >= 2) {
      setIsSearchingOutput(true);
      searchTimeoutRef.current = setTimeout(async () => {
        const results = await searchItems(value);
        setOutputSuggestions(results);
        setShowOutputSuggestions(true);
        setIsSearchingOutput(false);
      }, 300);
    } else {
      setOutputSuggestions([]);
      setShowOutputSuggestions(false);
    }
  };

  const selectOutputItem = (item: GEItem) => {
    setSelectedOutputItem(item);
    setOutputItemName(item.name);
    setOutputItemId(item.id);
    setOutputItemIcon(item.icon);
    setShowOutputSuggestions(false);
    if (!recipeName) {
      setRecipeName(item.name);
    }
  };

  const handleComponentSearch = (value: string) => {
    setComponentSearch(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (value.length >= 2) {
      setIsSearchingComponent(true);
      searchTimeoutRef.current = setTimeout(async () => {
        const results = await searchItems(value);
        setComponentSuggestions(results);
        setShowComponentSuggestions(true);
        setIsSearchingComponent(false);
      }, 300);
    } else {
      setComponentSuggestions([]);
      setShowComponentSuggestions(false);
    }
  };

  const addComponent = (item: GEItem) => {
    const qty = parseInt(componentQuantity) || 1;
    setComponents([...components, {
      itemId: item.id,
      itemName: item.name,
      itemIcon: item.icon,
      quantityRequired: qty,
    }]);
    setComponentSearch("");
    setComponentQuantity("1");
    setShowComponentSuggestions(false);
  };

  const removeComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const createRecipeMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      outputItemName: string; 
      outputItemId?: number;
      outputItemIcon?: string;
      outputQuantity: number;
      notes?: string;
      components: ComponentInput[];
    }) => {
      const res = await apiRequest("POST", "/api/recipes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      setIsCreateRecipeOpen(false);
      resetRecipeForm();
      toast({ title: "Recipe created!", description: "Your recipe template has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create recipe", variant: "destructive" });
    },
  });

  const startRunMutation = useMutation({
    mutationFn: async (data: { recipeId: string; targetSellPrice?: number }) => {
      const res = await apiRequest("POST", "/api/recipe-runs", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipe-runs"] });
      setIsStartRunOpen(false);
      setSelectedRecipeForRun(null);
      setTargetSellPrice("");
      toast({ title: "Run started!", description: "Start logging your component purchases." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start run", variant: "destructive" });
    },
  });

  const logComponentMutation = useMutation({
    mutationFn: async (data: { 
      runId: string; 
      componentId: string; 
      quantityAcquired: number; 
      buyPrice: number;
      rsAccountId?: string;
    }) => {
      const res = await apiRequest("POST", `/api/recipe-runs/${data.runId}/components`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipe-runs"] });
      if (selectedRun) {
        fetchRunDetails(selectedRun.id);
      }
      setIsLogComponentOpen(false);
      resetLogForm();
      toast({ title: "Component logged!", description: "Your purchase has been recorded." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log component", variant: "destructive" });
    },
  });

  const completeRunMutation = useMutation({
    mutationFn: async (data: { runId: string; sellPrice: number }) => {
      const res = await apiRequest("POST", `/api/recipe-runs/${data.runId}/complete`, { sellPrice: data.sellPrice });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipe-runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/flips"] });
      setIsCompleteRunOpen(false);
      setSelectedRun(null);
      setCompleteSellPrice("");
      toast({ title: "Run completed!", description: "Profit has been added to your stats." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to complete run", variant: "destructive" });
    },
  });

  const deleteRecipeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/recipes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({ title: "Recipe deleted" });
    },
  });

  const resetRecipeForm = () => {
    setRecipeName("");
    setOutputItemName("");
    setOutputItemId(undefined);
    setOutputItemIcon(undefined);
    setOutputQuantity("1");
    setRecipeNotes("");
    setComponents([]);
    setSelectedOutputItem(null);
  };

  const resetLogForm = () => {
    setLogComponentId("");
    setLogQuantity("");
    setLogBuyPrice("");
    setLogRsAccountId("");
  };

  const fetchRunDetails = async (runId: string) => {
    const response = await fetch(`/api/recipe-runs/${runId}`);
    if (response.ok) {
      const data = await response.json();
      setSelectedRun(data);
    }
  };

  const openRunDetails = async (run: RecipeRun) => {
    await fetchRunDetails(run.id);
  };

  const getRecipeForRun = (run: RecipeRun) => {
    return recipes.find(r => r.id === run.recipeId);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Recipe Crafting</h1>
              <p className="text-muted-foreground">Track component purchases and craft profits</p>
            </div>
          </div>
          <Button onClick={() => setIsCreateRecipeOpen(true)} data-testid="button-create-recipe">
            <Plus className="h-4 w-4 mr-2" />
            New Recipe
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="recipes" data-testid="tab-recipes">
              Recipes ({recipes.length})
            </TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active-runs">
              Active Runs ({activeRuns.length})
            </TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed-runs">
              Completed ({completedRuns.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recipes">
            {isLoadingRecipes ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : recipes.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No recipes yet</p>
                  <Button onClick={() => setIsCreateRecipeOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Recipe
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recipes.map((recipe) => (
                  <RecipeCard 
                    key={recipe.id} 
                    recipe={recipe}
                    onStartRun={async () => {
                      const response = await fetch(`/api/recipes/${recipe.id}`);
                      if (response.ok) {
                        const fullRecipe = await response.json();
                        setSelectedRecipeForRun(fullRecipe);
                        setIsStartRunOpen(true);
                      }
                    }}
                    onDelete={() => deleteRecipeMutation.mutate(recipe.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="active">
            {isLoadingRuns ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : activeRuns.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No active crafting runs</p>
                  <p className="text-sm text-muted-foreground">Start a run from one of your recipes</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {activeRuns.map((run) => {
                  const recipe = getRecipeForRun(run);
                  return (
                    <Card key={run.id} className="cursor-pointer hover-elevate" onClick={() => openRunDetails(run)} data-testid={`card-run-${run.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {recipe?.outputItemIcon && (
                              <ItemIcon itemIcon={recipe.outputItemIcon} itemName={recipe.outputItemName} size="sm" />
                            )}
                            <CardTitle className="text-lg">{recipe?.name || "Unknown Recipe"}</CardTitle>
                          </div>
                          <Badge variant={run.status === "ready" ? "default" : "secondary"}>
                            {run.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Cost so far:</span>
                          <span className="font-mono font-medium">{formatGP(run.totalComponentCost || 0)}</span>
                        </div>
                        {run.targetSellPrice && (
                          <div className="flex items-center justify-between text-sm mt-1">
                            <span className="text-muted-foreground">Target sell:</span>
                            <span className="font-mono">{formatGP(run.targetSellPrice)}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-end mt-2 text-xs text-muted-foreground">
                          Click to manage <ChevronRight className="h-3 w-3 ml-1" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed">
            {completedRuns.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No completed runs yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {completedRuns.map((run) => {
                  const recipe = getRecipeForRun(run);
                  const profit = run.profit || 0;
                  return (
                    <Card key={run.id} data-testid={`card-completed-run-${run.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          {recipe?.outputItemIcon && (
                            <ItemIcon itemIcon={recipe.outputItemIcon} itemName={recipe.outputItemName} size="sm" />
                          )}
                          <CardTitle className="text-lg">{recipe?.name || "Unknown"}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Cost:</span>
                            <span className="font-mono ml-2">{formatGP(run.totalComponentCost || 0)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Sold:</span>
                            <span className="font-mono ml-2">{formatGP(run.actualSellPrice || 0)}</span>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t flex items-center justify-between">
                          <span className="text-muted-foreground">Profit:</span>
                          <Badge variant={profit >= 0 ? "default" : "destructive"} className={profit >= 0 ? "bg-green-500/20 text-green-400" : ""}>
                            {profit >= 0 ? "+" : ""}{formatGP(profit)}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Create Recipe Dialog */}
        <Dialog open={isCreateRecipeOpen} onOpenChange={setIsCreateRecipeOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Recipe</DialogTitle>
              <DialogDescription>Define the output item and required components</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label>Recipe Name</Label>
                <Input 
                  value={recipeName} 
                  onChange={(e) => setRecipeName(e.target.value)}
                  placeholder="e.g., Eldritch Crossbow"
                  data-testid="input-recipe-name"
                />
              </div>

              <div className="relative">
                <Label>Output Item</Label>
                <Input 
                  value={outputItemName} 
                  onChange={(e) => handleOutputSearch(e.target.value)}
                  placeholder="Search for the crafted item..."
                  data-testid="input-output-item"
                />
                {isSearchingOutput && (
                  <Loader2 className="absolute right-3 top-8 h-4 w-4 animate-spin" />
                )}
                {showOutputSuggestions && outputSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {outputSuggestions.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 p-2 hover:bg-accent cursor-pointer"
                        onClick={() => selectOutputItem(item)}
                      >
                        {item.icon && <ItemIcon itemIcon={item.icon} itemName={item.name} size="sm" />}
                        <span>{item.name}</span>
                        <span className="ml-auto text-sm text-muted-foreground font-mono">
                          {formatGP(item.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label>Output Quantity</Label>
                <Input 
                  type="number"
                  min="1"
                  value={outputQuantity} 
                  onChange={(e) => setOutputQuantity(e.target.value)}
                  data-testid="input-output-quantity"
                />
              </div>

              <div>
                <Label>Components</Label>
                <div className="space-y-2 mt-2">
                  {components.map((comp, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                      {comp.itemIcon && <ItemIcon itemIcon={comp.itemIcon} itemName={comp.itemName} size="sm" />}
                      <span className="flex-1">{comp.itemName}</span>
                      <span className="text-sm text-muted-foreground">x{comp.quantityRequired}</span>
                      <Button size="icon" variant="ghost" onClick={() => removeComponent(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
                
                <div className="mt-2 flex gap-2">
                  <div className="relative flex-1">
                    <Input 
                      value={componentSearch} 
                      onChange={(e) => handleComponentSearch(e.target.value)}
                      placeholder="Search component..."
                      data-testid="input-component-search"
                    />
                    {showComponentSuggestions && componentSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {componentSuggestions.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 p-2 hover:bg-accent cursor-pointer"
                            onClick={() => addComponent(item)}
                          >
                            {item.icon && <ItemIcon itemIcon={item.icon} itemName={item.name} size="sm" />}
                            <span>{item.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Input 
                    type="number" 
                    min="1"
                    value={componentQuantity}
                    onChange={(e) => setComponentQuantity(e.target.value)}
                    className="w-20"
                    placeholder="Qty"
                    data-testid="input-component-quantity"
                  />
                </div>
              </div>

              <div>
                <Label>Notes (optional)</Label>
                <Textarea 
                  value={recipeNotes} 
                  onChange={(e) => setRecipeNotes(e.target.value)}
                  placeholder="Any notes about this recipe..."
                  data-testid="input-recipe-notes"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateRecipeOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createRecipeMutation.mutate({
                  name: recipeName,
                  outputItemName,
                  outputItemId,
                  outputItemIcon,
                  outputQuantity: parseInt(outputQuantity) || 1,
                  notes: recipeNotes || undefined,
                  components,
                })}
                disabled={!recipeName || !outputItemName || createRecipeMutation.isPending}
                data-testid="button-save-recipe"
              >
                {createRecipeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Recipe
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Start Run Dialog */}
        <Dialog open={isStartRunOpen} onOpenChange={setIsStartRunOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start Crafting Run</DialogTitle>
              <DialogDescription>
                {selectedRecipeForRun?.name} - Track component purchases
              </DialogDescription>
            </DialogHeader>
            
            {selectedRecipeForRun && (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    {selectedRecipeForRun.outputItemIcon && (
                      <ItemIcon itemIcon={selectedRecipeForRun.outputItemIcon} itemName={selectedRecipeForRun.outputItemName} size="sm" />
                    )}
                    <span className="font-medium">{selectedRecipeForRun.outputItemName}</span>
                    <span className="text-muted-foreground">x{selectedRecipeForRun.outputQuantity}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedRecipeForRun.components?.length || 0} components required
                  </div>
                </div>

                <div>
                  <Label>Target Sell Price (optional)</Label>
                  <Input 
                    type="number"
                    value={targetSellPrice}
                    onChange={(e) => setTargetSellPrice(e.target.value)}
                    placeholder="Expected sell price..."
                    data-testid="input-target-sell-price"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsStartRunOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => startRunMutation.mutate({
                  recipeId: selectedRecipeForRun!.id,
                  targetSellPrice: targetSellPrice ? parseInt(targetSellPrice) : undefined,
                })}
                disabled={startRunMutation.isPending}
                data-testid="button-start-run"
              >
                {startRunMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Play className="h-4 w-4 mr-2" />
                Start Run
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Run Details Dialog */}
        <Dialog open={!!selectedRun} onOpenChange={(open) => !open && setSelectedRun(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedRun?.recipe?.name}</DialogTitle>
              <DialogDescription>Manage component purchases</DialogDescription>
            </DialogHeader>
            
            {selectedRun && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Total Cost</div>
                      <div className="text-xl font-mono font-bold">{formatGP(selectedRun.totalComponentCost || 0)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">Status</div>
                      <Badge className="mt-1">{selectedRun.status}</Badge>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Components</Label>
                    <Button size="sm" onClick={() => setIsLogComponentOpen(true)} data-testid="button-log-component">
                      <Plus className="h-4 w-4 mr-1" />
                      Log Purchase
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    {((selectedRun.recipe as any)?.components || [])?.map((comp: any) => {
                      const acquired = selectedRun.components?.filter((c: any) => c.componentId === comp.id) || [];
                      const totalAcquired = acquired.reduce((sum: number, c: any) => sum + c.quantityAcquired, 0);
                      const isComplete = totalAcquired >= comp.quantityRequired;
                      
                      return (
                        <div key={comp.id} className={`p-3 rounded-md border ${isComplete ? 'bg-green-500/10 border-green-500/30' : 'bg-muted'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {comp.itemIcon && <ItemIcon itemIcon={comp.itemIcon} itemName={comp.itemName} size="sm" />}
                              <span>{comp.itemName}</span>
                            </div>
                            <div className="text-sm">
                              <span className={isComplete ? "text-green-400" : "text-muted-foreground"}>
                                {totalAcquired}
                              </span>
                              <span className="text-muted-foreground">/{comp.quantityRequired}</span>
                            </div>
                          </div>
                          {acquired.length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {acquired.map((a: any, idx: number) => (
                                <div key={idx}>
                                  {a.quantityAcquired}x @ {formatGP(a.buyPrice)} each
                                  {a.rsAccount && ` (${a.rsAccount.displayName})`}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelectedRun(null)}>Close</Button>
                  <Button 
                    onClick={() => {
                      setCompleteSellPrice(selectedRun.targetSellPrice?.toString() || "");
                      setIsCompleteRunOpen(true);
                    }}
                    data-testid="button-complete-run"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Complete & Sell
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Log Component Dialog */}
        <Dialog open={isLogComponentOpen} onOpenChange={setIsLogComponentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Component Purchase</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label>Component</Label>
                <Select value={logComponentId} onValueChange={setLogComponentId}>
                  <SelectTrigger data-testid="select-component">
                    <SelectValue placeholder="Select component..." />
                  </SelectTrigger>
                  <SelectContent>
                    {((selectedRun?.recipe as any)?.components || [])?.map((comp: any) => (
                      <SelectItem key={comp.id} value={comp.id}>
                        {comp.itemName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantity</Label>
                <Input 
                  type="number"
                  min="1"
                  value={logQuantity}
                  onChange={(e) => setLogQuantity(e.target.value)}
                  data-testid="input-log-quantity"
                />
              </div>

              <div>
                <Label>Buy Price (per item)</Label>
                <Input 
                  type="number"
                  min="1"
                  value={logBuyPrice}
                  onChange={(e) => setLogBuyPrice(e.target.value)}
                  data-testid="input-log-buy-price"
                />
              </div>

              {rsAccounts.length > 0 && (
                <div>
                  <Label>RS Account (optional)</Label>
                  <Select value={logRsAccountId} onValueChange={setLogRsAccountId}>
                    <SelectTrigger data-testid="select-rs-account">
                      <SelectValue placeholder="Select account..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {rsAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsLogComponentOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => logComponentMutation.mutate({
                  runId: selectedRun!.id,
                  componentId: logComponentId,
                  quantityAcquired: parseInt(logQuantity) || 0,
                  buyPrice: parseInt(logBuyPrice) || 0,
                  rsAccountId: logRsAccountId || undefined,
                })}
                disabled={!logComponentId || !logQuantity || !logBuyPrice || logComponentMutation.isPending}
                data-testid="button-save-component"
              >
                {logComponentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Log Purchase
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Complete Run Dialog */}
        <Dialog open={isCompleteRunOpen} onOpenChange={setIsCompleteRunOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Complete Run</DialogTitle>
              <DialogDescription>Enter the sell price for the crafted item</DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Component Cost:</span>
                  <span className="font-mono font-medium">{formatGP(selectedRun?.totalComponentCost || 0)}</span>
                </div>
              </div>

              <div>
                <Label>Sell Price</Label>
                <Input 
                  type="number"
                  min="1"
                  value={completeSellPrice}
                  onChange={(e) => setCompleteSellPrice(e.target.value)}
                  placeholder="Enter sell price..."
                  data-testid="input-complete-sell-price"
                />
              </div>

              {completeSellPrice && selectedRun && (
                <div className="p-3 bg-muted rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Estimated Profit:</span>
                    <span className={`font-mono font-bold ${parseInt(completeSellPrice) > (selectedRun.totalComponentCost || 0) ? 'text-green-400' : 'text-red-400'}`}>
                      {formatGP(parseInt(completeSellPrice) - (selectedRun.totalComponentCost || 0))}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">(Before GE tax)</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCompleteRunOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => completeRunMutation.mutate({
                  runId: selectedRun!.id,
                  sellPrice: parseInt(completeSellPrice),
                })}
                disabled={!completeSellPrice || completeRunMutation.isPending}
                data-testid="button-confirm-complete"
              >
                {completeRunMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Complete & Add to Stats
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function RecipeCard({ 
  recipe, 
  onStartRun, 
  onDelete 
}: { 
  recipe: Recipe; 
  onStartRun: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="hover-elevate" data-testid={`card-recipe-${recipe.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {recipe.outputItemIcon && (
              <ItemIcon itemIcon={recipe.outputItemIcon} itemName={recipe.outputItemName} size="sm" />
            )}
            <CardTitle className="text-lg">{recipe.name}</CardTitle>
          </div>
        </div>
        <CardDescription>{recipe.outputItemName} x{recipe.outputQuantity}</CardDescription>
      </CardHeader>
      <CardContent>
        {recipe.notes && (
          <p className="text-sm text-muted-foreground mb-3">{recipe.notes}</p>
        )}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onStartRun} className="flex-1" data-testid={`button-start-run-${recipe.id}`}>
            <Play className="h-4 w-4 mr-1" />
            Start Run
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} data-testid={`button-delete-recipe-${recipe.id}`}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
