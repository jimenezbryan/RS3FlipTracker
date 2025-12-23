import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { User, Plus, Trash2, Star, Edit, Crown, Swords, Shield, Users, Camera, Loader2 } from "lucide-react";
import type { RsAccount } from "@shared/schema";

const rsAccountSchema = z.object({
  displayName: z.string().min(1, "RSN is required").max(12, "RSN max 12 characters"),
  accountType: z.enum(["Main", "Ironman", "HCIM", "Ultimate", "GIM", "Alt", "Other"]),
  preferredWorld: z.coerce.number().int().positive().optional().or(z.literal("")),
  notes: z.string().optional(),
  isDefault: z.boolean().optional(),
});

type RsAccountForm = z.infer<typeof rsAccountSchema>;

const accountTypeIcons: Record<string, JSX.Element> = {
  Main: <Crown className="h-4 w-4" />,
  Ironman: <Shield className="h-4 w-4" />,
  HCIM: <Shield className="h-4 w-4 text-red-500" />,
  Ultimate: <Shield className="h-4 w-4 text-gray-400" />,
  GIM: <Users className="h-4 w-4" />,
  Alt: <Swords className="h-4 w-4" />,
  Other: <User className="h-4 w-4" />,
};

const accountTypeColors: Record<string, string> = {
  Main: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Ironman: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  HCIM: "bg-red-500/20 text-red-400 border-red-500/30",
  Ultimate: "bg-gray-600/20 text-gray-400 border-gray-600/30",
  GIM: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Alt: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Other: "bg-muted text-muted-foreground border-muted",
};

export default function Profile() {
  const { user, refetchUser } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<RsAccount | null>(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: rsAccounts = [], isLoading: accountsLoading } = useQuery<RsAccount[]>({
    queryKey: ["/api/rs-accounts"],
  });

  const form = useForm<RsAccountForm>({
    resolver: zodResolver(rsAccountSchema),
    defaultValues: {
      displayName: "",
      accountType: "Main",
      preferredWorld: "",
      notes: "",
      isDefault: false,
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: async (data: RsAccountForm) => {
      return await apiRequest("POST", "/api/rs-accounts", {
        ...data,
        preferredWorld: data.preferredWorld ? Number(data.preferredWorld) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rs-accounts"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "RS Account added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add RS account", variant: "destructive" });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RsAccountForm> }) => {
      return await apiRequest("PATCH", `/api/rs-accounts/${id}`, {
        ...data,
        preferredWorld: data.preferredWorld ? Number(data.preferredWorld) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rs-accounts"] });
      setEditingAccount(null);
      setIsDialogOpen(false);
      form.reset();
      toast({ title: "RS Account updated" });
    },
    onError: () => {
      toast({ title: "Failed to update RS account", variant: "destructive" });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/rs-accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rs-accounts"] });
      toast({ title: "RS Account removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove RS account", variant: "destructive" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/rs-accounts/${id}/set-default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rs-accounts"] });
      toast({ title: "Default account updated" });
    },
    onError: () => {
      toast({ title: "Failed to set default account", variant: "destructive" });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string }) => {
      return await apiRequest("PATCH", "/api/user/profile", data);
    },
    onSuccess: () => {
      refetchUser();
      setIsEditProfileOpen(false);
      toast({ title: "Profile updated" });
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      refetchUser();
      toast({ title: "Avatar updated" });
    },
    onError: () => {
      toast({ title: "Failed to upload avatar", variant: "destructive" });
    },
  });

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: "File too large", description: "Max 2MB", variant: "destructive" });
        return;
      }
      uploadAvatarMutation.mutate(file);
    }
  };

  const openEditProfile = () => {
    setEditFirstName(user?.firstName ?? "");
    setEditLastName(user?.lastName ?? "");
    setIsEditProfileOpen(true);
  };

  const onSubmit = (data: RsAccountForm) => {
    if (editingAccount) {
      updateAccountMutation.mutate({ id: editingAccount.id, data });
    } else {
      createAccountMutation.mutate(data);
    }
  };

  const openEditDialog = (account: RsAccount) => {
    setEditingAccount(account);
    form.reset({
      displayName: account.displayName,
      accountType: account.accountType as RsAccountForm["accountType"],
      preferredWorld: account.preferredWorld ?? "",
      notes: account.notes ?? "",
      isDefault: account.isDefault ?? false,
    });
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingAccount(null);
    form.reset({
      displayName: "",
      accountType: "Main",
      preferredWorld: "",
      notes: "",
      isDefault: false,
    });
    setIsDialogOpen(true);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please log in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
            <CardDescription>Manage your account and RuneScape characters</CardDescription>
          </div>
          <Button variant="outline" onClick={openEditProfile} data-testid="button-edit-profile">
            <Edit className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="h-16 w-16 cursor-pointer" onClick={handleAvatarClick}>
                <AvatarImage src={user.profileImageUrl ?? undefined} alt={user.firstName ?? "User"} />
                <AvatarFallback className="text-xl">
                  {(user.firstName?.[0] ?? user.email?.[0] ?? "U").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div 
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={handleAvatarClick}
              >
                {uploadAvatarMutation.isPending ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-avatar"
              />
            </div>
            <div>
              <h2 className="text-xl font-semibold">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-muted-foreground">{user.email}</p>
              {user.isAdmin && (
                <Badge className="mt-1 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  Admin
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update your display name</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="firstName" className="text-sm font-medium">First Name</label>
              <Input
                id="firstName"
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                placeholder="First name"
                data-testid="input-first-name"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="lastName" className="text-sm font-medium">Last Name</label>
              <Input
                id="lastName"
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                placeholder="Last name"
                data-testid="input-last-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditProfileOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => updateProfileMutation.mutate({ firstName: editFirstName, lastName: editLastName })}
              disabled={updateProfileMutation.isPending}
              data-testid="button-save-profile"
            >
              {updateProfileMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5" />
              RuneScape Accounts
            </CardTitle>
            <CardDescription>
              Manage your RS3 characters for flip tracking
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog} data-testid="button-add-rs-account">
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAccount ? "Edit RS Account" : "Add RS Account"}</DialogTitle>
                <DialogDescription>
                  {editingAccount 
                    ? "Update your RuneScape character details"
                    : "Add a new RuneScape character to track flips separately"
                  }
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Name (RSN)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Your RuneScape name" 
                            maxLength={12}
                            data-testid="input-rsn"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="accountType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-account-type">
                              <SelectValue placeholder="Select account type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Main">Main</SelectItem>
                            <SelectItem value="Ironman">Ironman</SelectItem>
                            <SelectItem value="HCIM">Hardcore Ironman</SelectItem>
                            <SelectItem value="Ultimate">Ultimate Ironman</SelectItem>
                            <SelectItem value="GIM">Group Ironman</SelectItem>
                            <SelectItem value="Alt">Alt</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="preferredWorld"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred World (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="e.g., 84" 
                            data-testid="input-world"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Any notes about this account..."
                            data-testid="input-notes"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isDefault"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Default Account</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Use this account by default when logging flips
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-default"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createAccountMutation.isPending || updateAccountMutation.isPending}
                      data-testid="button-save-rs-account"
                    >
                      {editingAccount ? "Update" : "Add Account"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {accountsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading accounts...</div>
          ) : rsAccounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Swords className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No RS accounts added yet.</p>
              <p className="text-sm">Add your first character to start tracking flips per account.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rsAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover-elevate"
                  data-testid={`rs-account-${account.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${accountTypeColors[account.accountType ?? "Other"]}`}>
                      {accountTypeIcons[account.accountType ?? "Other"]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{account.displayName}</span>
                        {account.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {account.accountType}
                        </Badge>
                        {account.preferredWorld && (
                          <span>World {account.preferredWorld}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!account.isDefault && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDefaultMutation.mutate(account.id)}
                        disabled={setDefaultMutation.isPending}
                        title="Set as default"
                        data-testid={`button-set-default-${account.id}`}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(account)}
                      data-testid={`button-edit-${account.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteAccountMutation.mutate(account.id)}
                      disabled={deleteAccountMutation.isPending}
                      className="text-destructive hover:text-destructive"
                      data-testid={`button-delete-${account.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
