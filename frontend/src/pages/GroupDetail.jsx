import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { apiClient } from "../App";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Plus, 
  Play, 
  Trash2, 
  User,
  Loader2,
  Edit,
  Save,
  Link as LinkIcon,
  Copy,
  Mail,
  RefreshCw,
  Key,
  Send,
  MessageCircle,
  Circle,
  Eye,
  EyeOff
} from "lucide-react";
import { format } from "date-fns";

const GroupDetail = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [membersAccess, setMembersAccess] = useState([]);
  const [accessLink, setAccessLink] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPasscodes, setShowPasscodes] = useState(false);
  const [newChatMessage, setNewChatMessage] = useState("");
  const [sendingChat, setSendingChat] = useState(false);

  // Form state
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberPhone, setMemberPhone] = useState("");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCurrency, setEditCurrency] = useState("");

  // Passcode update dialog
  const [updatingPasscode, setUpdatingPasscode] = useState(null);
  const [newPasscode, setNewPasscode] = useState("");

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

  const fetchMembersAccess = async () => {
    try {
      const res = await apiClient.get(`/groups/${groupId}/members-access`);
      setMembersAccess(res.data);
    } catch (error) {
      console.error("Failed to fetch members access");
    }
  };

  const fetchAccessLink = async () => {
    try {
      const res = await apiClient.get(`/groups/${groupId}/access-link`);
      setAccessLink(res.data);
    } catch (error) {
      console.error("Failed to fetch access link");
    }
  };

  const fetchChatMessages = async () => {
    try {
      const res = await apiClient.get(`/groups/${groupId}/chat`);
      setChatMessages(res.data);
    } catch (error) {
      console.error("Failed to fetch chat");
    }
  };

  useEffect(() => {
    fetchGroup();
    fetchMembersAccess();
    fetchAccessLink();
    fetchChatMessages();
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
      toast.success(memberEmail ? "Member added! Invitation email sent." : "Member added!");
      setAddMemberOpen(false);
      setMemberName("");
      setMemberEmail("");
      setMemberPhone("");
      fetchGroup();
      fetchMembersAccess();
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
      fetchMembersAccess();
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

  const handleUpdatePasscode = async (memberId) => {
    try {
      const res = await apiClient.put(`/groups/${groupId}/members/${memberId}/passcode`, {
        passcode: newPasscode || null
      });
      toast.success(res.data.email_sent ? "Passcode updated! Email sent." : "Passcode updated!");
      setUpdatingPasscode(null);
      setNewPasscode("");
      fetchMembersAccess();
    } catch (error) {
      toast.error("Failed to update passcode");
    }
  };

  const handleResendInvite = async (memberId) => {
    try {
      await apiClient.post(`/groups/${groupId}/members/${memberId}/resend-invite`);
      toast.success("Invitation sent!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send invitation");
    }
  };

  const copyToClipboard = async (text, label) => {
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(`${label} copied!`);
        return;
      } catch (err) {
        // Fall through to fallback method
        console.log("Clipboard API failed, using fallback");
      }
    }
    
    // Fallback: Create a temporary textarea element
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Make it invisible but still part of the document
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";
    textArea.style.opacity = "0";
    textArea.setAttribute("readonly", "");
    
    document.body.appendChild(textArea);
    
    // Handle iOS devices
    const range = document.createRange();
    range.selectNodeContents(textArea);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    textArea.setSelectionRange(0, 999999);
    
    try {
      const successful = document.execCommand("copy");
      if (successful) {
        toast.success(`${label} copied!`);
      } else {
        // Show the text in a prompt as last resort
        window.prompt(`Copy this ${label.toLowerCase()}:`, text);
      }
    } catch (err) {
      // Show the text in a prompt as last resort
      window.prompt(`Copy this ${label.toLowerCase()}:`, text);
    }
    
    document.body.removeChild(textArea);
    selection.removeAllRanges();
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!newChatMessage.trim()) return;

    setSendingChat(true);
    try {
      await apiClient.post(`/groups/${groupId}/chat`, {
        content: newChatMessage.trim()
      });
      setNewChatMessage("");
      fetchChatMessages();
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setSendingChat(false);
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
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{group?.name}</h1>
          <p className="text-muted-foreground">{group?.description || "No description"}</p>
        </div>
        <Link to={`/groups/${groupId}/spin`}>
          <Button className="gap-2" data-testid="start-spin-btn">
            <Play className="w-4 h-4" /> Start Spin
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="members" className="space-y-6">
        <TabsList>
          <TabsTrigger value="members" className="gap-2">
            <User className="w-4 h-4" /> Members
          </TabsTrigger>
          <TabsTrigger value="access" className="gap-2">
            <Key className="w-4 h-4" /> Member Access
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-2">
            <MessageCircle className="w-4 h-4" /> Chat
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Edit className="w-4 h-4" /> Settings
          </TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Group Members</CardTitle>
                <CardDescription>{members.length} members in this group</CardDescription>
              </div>
              <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2" data-testid="add-member-btn">
                    <Plus className="w-4 h-4" /> Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Member</DialogTitle>
                    <DialogDescription>
                      Add a member to this group. If you provide an email, they'll receive an invitation with their access passcode.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddMember} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="memberName">Name *</Label>
                      <Input
                        id="memberName"
                        value={memberName}
                        onChange={(e) => setMemberName(e.target.value)}
                        placeholder="John Doe"
                        data-testid="member-name-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="memberEmail">Email (optional)</Label>
                      <Input
                        id="memberEmail"
                        type="email"
                        value={memberEmail}
                        onChange={(e) => setMemberEmail(e.target.value)}
                        placeholder="john@example.com"
                        data-testid="member-email-input"
                      />
                      <p className="text-xs text-muted-foreground">
                        An invitation email with access passcode will be sent if provided
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="memberPhone">Phone (optional)</Label>
                      <Input
                        id="memberPhone"
                        value={memberPhone}
                        onChange={(e) => setMemberPhone(e.target.value)}
                        placeholder="+1 234 567 8900"
                        data-testid="member-phone-input"
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={adding} data-testid="submit-member-btn">
                        {adding && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Add Member
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No members yet. Add your first member!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          {member.email && (
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          )}
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Member</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove {member.name}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveMember(member.id, member.name)}
                              className="bg-destructive hover:bg-destructive/90"
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
        </TabsContent>

        {/* Member Access Tab */}
        <TabsContent value="access">
          <div className="space-y-6">
            {/* Access Link Card */}
            <Card className="border-border/50 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="w-5 h-5" />
                  Group Access Link
                </CardTitle>
                <CardDescription>
                  Share this link with members. They'll need their unique passcode to access the group.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {accessLink ? (
                  <div className="flex gap-2">
                    <Input
                      value={accessLink.access_link}
                      readOnly
                      className="flex-1 font-mono text-sm"
                    />
                    <Button 
                      variant="outline"
                      onClick={() => copyToClipboard(accessLink.access_link, "Link")}
                      title="Copy link"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading access link...</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Members with Passcodes */}
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Member Passcodes</CardTitle>
                  <CardDescription>
                    Each member has a unique passcode to access the group
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPasscodes(!showPasscodes)}
                  >
                    {showPasscodes ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                    {showPasscodes ? "Hide" : "Show"} Passcodes
                  </Button>
                  <Button variant="outline" size="sm" onClick={fetchMembersAccess}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {membersAccess.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No members yet</p>
                ) : (
                  <div className="rounded-lg border">
                    <div className="grid grid-cols-12 gap-4 p-3 bg-muted/50 font-medium text-sm">
                      <div className="col-span-3">Name</div>
                      <div className="col-span-3">Email</div>
                      <div className="col-span-3">Passcode</div>
                      <div className="col-span-1">Status</div>
                      <div className="col-span-2 text-right">Actions</div>
                    </div>
                    {membersAccess.map((member) => (
                      <div key={member.id} className="grid grid-cols-12 gap-4 p-3 border-t items-center">
                        <div className="col-span-3 font-medium">{member.name}</div>
                        <div className="col-span-3 text-sm text-muted-foreground">
                          {member.email || "-"}
                        </div>
                        <div className="col-span-3 flex items-center">
                          <code className="px-2 py-1 rounded bg-muted text-sm">
                            {showPasscodes ? member.passcode : "••••••••"}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-1 h-6 w-6"
                            onClick={() => copyToClipboard(member.passcode, "Passcode")}
                            title="Copy passcode"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="col-span-1">
                          <Badge 
                            variant="outline" 
                            className={member.is_online 
                              ? "bg-green-500/10 text-green-500 border-green-500/20" 
                              : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                            }
                          >
                            <Circle className={`w-2 h-2 mr-1 ${member.is_online ? "fill-green-500" : "fill-gray-500"}`} />
                            {member.is_online ? "Online" : "Offline"}
                          </Badge>
                        </div>
                        <div className="col-span-2 flex justify-end gap-1">
                          {member.email && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleResendInvite(member.id)}
                              title="Resend invitation"
                            >
                              <Mail className="w-4 h-4" />
                            </Button>
                          )}
                          <Dialog 
                            open={updatingPasscode === member.id} 
                            onOpenChange={(open) => !open && setUpdatingPasscode(null)}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setUpdatingPasscode(member.id)}
                                title="Update passcode"
                              >
                                <Key className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Update Passcode</DialogTitle>
                                <DialogDescription>
                                  Update passcode for {member.name}. Leave empty to auto-generate.
                                  {member.email && " They will receive an email notification."}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="py-4">
                                <Label>New Passcode (optional)</Label>
                                <Input
                                  value={newPasscode}
                                  onChange={(e) => setNewPasscode(e.target.value)}
                                  placeholder="Leave empty for auto-generate"
                                  className="mt-2"
                                />
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setUpdatingPasscode(null)}>
                                  Cancel
                                </Button>
                                <Button onClick={() => handleUpdatePasscode(member.id)}>
                                  Update Passcode
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Group Chat
              </CardTitle>
              <CardDescription>
                View and participate in member discussions as a moderator
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <ScrollArea className="h-[400px] rounded-lg border p-4">
                  {chatMessages.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No messages yet. Be the first to send a message!
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {chatMessages.map((msg) => (
                        <div key={msg.id} className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium">
                              {msg.member_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="font-medium text-sm">{msg.member_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(msg.created_at), "MMM d, h:mm a")}
                              </span>
                            </div>
                            <p className="text-sm mt-1">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                
                <form onSubmit={handleSendChat} className="flex gap-2">
                  <Input
                    value={newChatMessage}
                    onChange={(e) => setNewChatMessage(e.target.value)}
                    placeholder="Send a message as moderator..."
                    maxLength={500}
                  />
                  <Button type="submit" disabled={sendingChat || !newChatMessage.trim()}>
                    {sendingChat ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Group Settings</CardTitle>
              <CardDescription>Update group information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={!editing}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  disabled={!editing}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contribution Amount</Label>
                  <Input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    disabled={!editing}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={editCurrency} onValueChange={setEditCurrency} disabled={!editing}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="NGN">NGN</SelectItem>
                      <SelectItem value="KES">KES</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                {editing ? (
                  <>
                    <Button onClick={handleSaveGroup} disabled={saving}>
                      {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      <Save className="w-4 h-4 mr-2" /> Save Changes
                    </Button>
                    <Button variant="outline" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Edit className="w-4 h-4 mr-2" /> Edit
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50 mt-6">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deleting}>
                    {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Group
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Group</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the group, all members, and session history.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteGroup}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
};

export default GroupDetail;
