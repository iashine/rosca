import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { apiClient } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Plus, 
  Play, 
  Trash2, 
  User,
  Loader2,
  Edit,
  Save
} from "lucide-react";

const GroupDetail = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberPhone, setMemberPhone] = useState("");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCurrency, setEditCurrency] = useState("");

  const fetchGroup = async () => {
    try {
      const [groupRes, membersRes] = await Promise.all([
        apiClient.get(`/groups/${groupId}`),
        apiClient.get(`/groups/${groupId}/members`)
      ]);
      setGroup(groupRes.data);
      setMembers(membersRes.data);
      setEditName(groupRes.data.name);
      setEditDescription(groupRes.data.description);
      setEditAmount(groupRes.data.contribution_amount.toString());
      setEditCurrency(groupRes.data.currency);
    } catch (error) {
      toast.error("Failed to load group");
      navigate("/groups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroup();
  }, [groupId]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!memberName.trim()) {
      toast.error("Please enter a member name");
      return;
    }

    setAdding(true);
    try {
      await apiClient.post(`/groups/${groupId}/members`, {
        name: memberName.trim(),
        email: memberEmail.trim() || null,
        phone: memberPhone.trim() || null
      });
      toast.success("Member added!");
      setAddMemberOpen(false);
      setMemberName("");
      setMemberEmail("");
      setMemberPhone("");
      fetchGroup();
    } catch (error) {
      toast.error("Failed to add member");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    try {
      await apiClient.delete(`/groups/${groupId}/members/${memberId}`);
      toast.success(`${memberName} removed`);
      fetchGroup();
    } catch (error) {
      toast.error("Failed to remove member");
    }
  };

  const handleSaveGroup = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/groups/${groupId}`, {
        name: editName.trim(),
        description: editDescription.trim(),
        contribution_amount: parseFloat(editAmount) || 0,
        currency: editCurrency
      });
      toast.success("Group updated!");
      setEditing(false);
      fetchGroup();
    } catch (error) {
      toast.error("Failed to update group");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    setDeleting(true);
    try {
      await apiClient.delete(`/groups/${groupId}`);
      toast.success("Group deleted");
      navigate("/groups");
    } catch (error) {
      toast.error("Failed to delete group");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/groups">
          <Button variant="ghost" size="icon" data-testid="back-to-groups">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{group.name}</h1>
          <p className="text-muted-foreground">{group.description || "No description"}</p>
        </div>
        <Link to={`/groups/${groupId}/spin`}>
          <Button className="spin-button" data-testid="start-spin-session">
            <Play className="w-4 h-4 mr-2" /> Start Spin
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Group Details */}
        <Card className="border-border/50 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Group Details</CardTitle>
            {!editing ? (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} data-testid="edit-group-btn">
                <Edit className="w-4 h-4 mr-1" /> Edit
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {editing ? (
              <>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)}
                    data-testid="edit-group-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    value={editDescription} 
                    onChange={(e) => setEditDescription(e.target.value)}
                    data-testid="edit-group-description"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input 
                      type="number" 
                      value={editAmount} 
                      onChange={(e) => setEditAmount(e.target.value)}
                      data-testid="edit-group-amount"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select value={editCurrency} onValueChange={setEditCurrency}>
                      <SelectTrigger data-testid="edit-group-currency">
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
                <Button onClick={handleSaveGroup} disabled={saving} className="w-full" data-testid="save-group-btn">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" /> Save Changes
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Contribution</p>
                  <p className="font-mono text-lg font-semibold">
                    {group.currency} {group.contribution_amount.toLocaleString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Members</p>
                  <p className="text-lg font-semibold">{members.length}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Moderator</p>
                  <p className="font-medium">{group.moderator_name}</p>
                </div>
              </>
            )}

            <div className="pt-4 border-t border-border">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="w-full" data-testid="delete-group-btn">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Group
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Group?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete "{group.name}" and all its members, sessions, and spin results. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteGroup}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      data-testid="confirm-delete-group"
                    >
                      {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* Members List */}
        <Card className="border-border/50 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Members ({members.length})</CardTitle>
            <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="add-member-btn">
                  <Plus className="w-4 h-4 mr-2" /> Add Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Member</DialogTitle>
                  <DialogDescription>
                    Add a new member to {group.name}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddMember} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="memberName">Name *</Label>
                    <Input
                      id="memberName"
                      placeholder="John Doe"
                      value={memberName}
                      onChange={(e) => setMemberName(e.target.value)}
                      data-testid="member-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="memberEmail">Email (optional)</Label>
                    <Input
                      id="memberEmail"
                      type="email"
                      placeholder="john@example.com"
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      data-testid="member-email-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="memberPhone">Phone (optional)</Label>
                    <Input
                      id="memberPhone"
                      placeholder="+1 234 567 8900"
                      value={memberPhone}
                      onChange={(e) => setMemberPhone(e.target.value)}
                      data-testid="member-phone-input"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setAddMemberOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={adding} data-testid="submit-add-member">
                      {adding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Add Member
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <div className="empty-state py-12">
                <User className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground mb-4">No members yet</p>
                <Button onClick={() => setAddMemberOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Add first member
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {members.map((member, index) => (
                  <div
                    key={member.id}
                    className="member-badge flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card animate-fade-in-up"
                    style={{ animationDelay: `${index * 30}ms` }}
                    data-testid={`member-${member.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <span className="font-semibold text-primary">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{member.name}</p>
                        {member.email && (
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        )}
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" data-testid={`remove-member-${member.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Member?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove {member.name} from this group?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveMember(member.id, member.name)}
                            className="bg-destructive text-destructive-foreground"
                            data-testid={`confirm-remove-${member.id}`}
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default GroupDetail;
