import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { apiClient } from "../App";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Skeleton } from "../components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { 
  Plus, 
  Users, 
  Play,
  Settings,
  Loader2
} from "lucide-react";

const Groups = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contributionAmount, setContributionAmount] = useState("");
  const [currency, setCurrency] = useState("USD");

  const fetchGroups = async () => {
    try {
      const res = await apiClient.get("/groups");
      setGroups(res.data);
    } catch (error) {
      toast.error("Failed to load groups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a group name");
      return;
    }

    setCreating(true);
    try {
      await apiClient.post("/groups", {
        name: name.trim(),
        description: description.trim(),
        contribution_amount: parseFloat(contributionAmount) || 0,
        currency
      });
      toast.success("Group created!");
      setCreateDialogOpen(false);
      setName("");
      setDescription("");
      setContributionAmount("");
      setCurrency("USD");
      fetchGroups();
    } catch (error) {
      toast.error("Failed to create group");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Layout title="Groups">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <p className="text-muted-foreground">Manage your ROSCA savings groups</p>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-group-btn">
              <Plus className="w-4 h-4 mr-2" /> Create Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Group</DialogTitle>
              <DialogDescription>
                Set up a new savings group for your community
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateGroup} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Group Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Family Savings Circle"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="group-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your group..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="group-description-input"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Contribution Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="100"
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount(e.target.value)}
                    data-testid="group-amount-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger data-testid="group-currency-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="INR">INR</SelectItem>
                      <SelectItem value="NGN">NGN</SelectItem>
                      <SelectItem value="KES">KES</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating} data-testid="submit-create-group">
                  {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Group
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Groups Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="empty-state py-16">
            <Users className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No groups yet</h3>
            <p className="text-muted-foreground mb-6">Create your first ROSCA group to get started</p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="empty-create-group">
              <Plus className="w-4 h-4 mr-2" /> Create your first group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group, index) => (
            <Card 
              key={group.id} 
              className="group-card border-border/50 animate-fade-in-up overflow-hidden"
              style={{ animationDelay: `${index * 50}ms` }}
              data-testid={`group-card-${group.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  <Link to={`/groups/${group.id}`}>
                    <Button variant="ghost" size="icon" data-testid={`group-settings-${group.id}`}>
                      <Settings className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
                
                <h3 className="text-lg font-semibold mb-1">{group.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {group.description || "No description"}
                </p>

                <div className="flex items-center justify-between text-sm mb-4">
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{group.member_count}</span> members
                  </span>
                  <span className="font-mono font-medium">
                    {group.currency} {group.contribution_amount.toLocaleString()}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Link to={`/groups/${group.id}`} className="flex-1">
                    <Button variant="outline" className="w-full" data-testid={`manage-group-${group.id}`}>
                      Manage
                    </Button>
                  </Link>
                  <Link to={`/groups/${group.id}/spin`}>
                    <Button className="btn-press" data-testid={`spin-group-btn-${group.id}`}>
                      <Play className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Layout>
  );
};

export default Groups;
