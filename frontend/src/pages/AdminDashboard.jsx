import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { useAuth, apiClient } from "../App";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
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
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { toast } from "sonner";
import { 
  Users, 
  FileText, 
  Plus, 
  Pencil, 
  Trash2, 
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Save,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Users state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  // CMS state
  const [cmsContent, setCmsContent] = useState([]);
  const [loadingCms, setLoadingCms] = useState(true);
  
  // Dialog states
  const [editingUser, setEditingUser] = useState(null);
  const [editingContent, setEditingContent] = useState(null);
  const [newContent, setNewContent] = useState({ key: "", title: "", content: "", content_type: "text" });
  const [showNewContentDialog, setShowNewContentDialog] = useState(false);
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Check if user is superadmin
    if (user?.role !== "superadmin") {
      toast.error("Access denied. Superadmin privileges required.");
      navigate("/");
      return;
    }
    
    fetchUsers();
    fetchCmsContent();
  }, [user, navigate]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await apiClient.get("/admin/users");
      setUsers(res.data);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error("Access denied");
        navigate("/");
      } else {
        toast.error("Failed to fetch users");
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchCmsContent = async () => {
    setLoadingCms(true);
    try {
      const res = await apiClient.get("/cms/content");
      setCmsContent(res.data);
    } catch (error) {
      toast.error("Failed to fetch CMS content");
    } finally {
      setLoadingCms(false);
    }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    setSaving(true);
    try {
      await apiClient.put(`/admin/users/${userId}/role`, { role: newRole });
      toast.success("User role updated");
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update role");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    
    try {
      await apiClient.delete(`/admin/users/${userId}`);
      toast.success("User deleted");
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete user");
    }
  };

  const handleCreateContent = async () => {
    if (!newContent.key || !newContent.title || !newContent.content) {
      toast.error("Please fill in all fields");
      return;
    }

    setSaving(true);
    try {
      await apiClient.post("/cms/content", newContent);
      toast.success("Content created");
      setShowNewContentDialog(false);
      setNewContent({ key: "", title: "", content: "", content_type: "text" });
      fetchCmsContent();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create content");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateContent = async () => {
    if (!editingContent) return;

    setSaving(true);
    try {
      await apiClient.put(`/cms/content/${editingContent.key}`, {
        title: editingContent.title,
        content: editingContent.content,
        content_type: editingContent.content_type
      });
      toast.success("Content updated");
      setEditingContent(null);
      fetchCmsContent();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update content");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContent = async (key) => {
    if (!window.confirm("Are you sure you want to delete this content?")) return;
    
    try {
      await apiClient.delete(`/cms/content/${key}`);
      toast.success("Content deleted");
      fetchCmsContent();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete content");
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case "superadmin":
        return <ShieldCheck className="w-4 h-4 text-red-500" />;
      case "moderator":
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return <ShieldAlert className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "superadmin":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "moderator":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  if (user?.role !== "superadmin") {
    return null;
  }

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-red-500" />
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">Manage users and CMS content</p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="users" className="flex items-center gap-2" data-testid="users-tab">
            <Users className="w-4 h-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="cms" className="flex items-center gap-2" data-testid="cms-tab">
            <FileText className="w-4 h-4" /> CMS
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage user roles and permissions</CardDescription>
              </div>
              <Button variant="outline" onClick={fetchUsers} data-testid="refresh-users-btn">
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Verified</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.name}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(u.role)}`}>
                              {getRoleIcon(u.role)}
                              {u.role}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs ${u.is_verified ? "bg-green-500/10 text-green-500" : "bg-yellow-500/10 text-yellow-500"}`}>
                              {u.is_verified ? "Yes" : "No"}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(u.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Dialog open={editingUser?.id === u.id} onOpenChange={(open) => !open && setEditingUser(null)}>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => setEditingUser(u)}
                                    disabled={u.id === user.id}
                                    data-testid={`edit-user-${u.id}`}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Edit User Role</DialogTitle>
                                    <DialogDescription>
                                      Change role for {editingUser?.name}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="py-4">
                                    <Label>Role</Label>
                                    <Select 
                                      value={editingUser?.role} 
                                      onValueChange={(value) => setEditingUser({...editingUser, role: value})}
                                    >
                                      <SelectTrigger className="mt-2">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="superadmin">Superadmin</SelectItem>
                                        <SelectItem value="moderator">Moderator</SelectItem>
                                        <SelectItem value="member">Member</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <DialogFooter>
                                    <Button 
                                      onClick={() => handleUpdateUserRole(editingUser?.id, editingUser?.role)}
                                      disabled={saving}
                                    >
                                      {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                      Save Changes
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteUser(u.id)}
                                disabled={u.id === user.id}
                                className="text-destructive hover:text-destructive"
                                data-testid={`delete-user-${u.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CMS Tab */}
        <TabsContent value="cms">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Content Management</CardTitle>
                <CardDescription>Manage landing page and app content</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={fetchCmsContent}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </Button>
                <Dialog open={showNewContentDialog} onOpenChange={setShowNewContentDialog}>
                  <DialogTrigger asChild>
                    <Button data-testid="add-content-btn">
                      <Plus className="w-4 h-4 mr-2" /> Add Content
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create New Content</DialogTitle>
                      <DialogDescription>
                        Add new content to your CMS
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Key (unique identifier)</Label>
                          <Input 
                            placeholder="e.g., hero_title"
                            value={newContent.key}
                            onChange={(e) => setNewContent({...newContent, key: e.target.value.toLowerCase().replace(/\s/g, '_')})}
                            data-testid="new-content-key"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Content Type</Label>
                          <Select 
                            value={newContent.content_type}
                            onValueChange={(value) => setNewContent({...newContent, content_type: value})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="html">HTML</SelectItem>
                              <SelectItem value="json">JSON</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input 
                          placeholder="Content title"
                          value={newContent.title}
                          onChange={(e) => setNewContent({...newContent, title: e.target.value})}
                          data-testid="new-content-title"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Content</Label>
                        <Textarea 
                          placeholder="Enter content..."
                          rows={6}
                          value={newContent.content}
                          onChange={(e) => setNewContent({...newContent, content: e.target.value})}
                          data-testid="new-content-body"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowNewContentDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateContent} disabled={saving}>
                        {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Create Content
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {loadingCms ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : cmsContent.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No CMS content yet</p>
                  <Button className="mt-4" onClick={() => setShowNewContentDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Create your first content
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Key</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cmsContent.map((content) => (
                        <TableRow key={content.key}>
                          <TableCell className="font-mono text-sm">{content.key}</TableCell>
                          <TableCell className="font-medium">{content.title}</TableCell>
                          <TableCell>
                            <span className="px-2 py-1 rounded text-xs bg-muted">
                              {content.content_type}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(content.updated_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Dialog open={editingContent?.key === content.key} onOpenChange={(open) => !open && setEditingContent(null)}>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => setEditingContent(content)}
                                    data-testid={`edit-content-${content.key}`}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>Edit Content</DialogTitle>
                                    <DialogDescription>
                                      Editing: {editingContent?.key}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <Label>Title</Label>
                                      <Input 
                                        value={editingContent?.title || ""}
                                        onChange={(e) => setEditingContent({...editingContent, title: e.target.value})}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Content Type</Label>
                                      <Select 
                                        value={editingContent?.content_type}
                                        onValueChange={(value) => setEditingContent({...editingContent, content_type: value})}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="text">Text</SelectItem>
                                          <SelectItem value="html">HTML</SelectItem>
                                          <SelectItem value="json">JSON</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Content</Label>
                                      <Textarea 
                                        rows={8}
                                        value={editingContent?.content || ""}
                                        onChange={(e) => setEditingContent({...editingContent, content: e.target.value})}
                                      />
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button variant="outline" onClick={() => setEditingContent(null)}>
                                      Cancel
                                    </Button>
                                    <Button onClick={handleUpdateContent} disabled={saving}>
                                      {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                      <Save className="w-4 h-4 mr-2" /> Save Changes
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteContent(content.key)}
                                className="text-destructive hover:text-destructive"
                                data-testid={`delete-content-${content.key}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
};

export default AdminDashboard;
