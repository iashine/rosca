import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { apiClient } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { 
  Users, 
  History, 
  Target, 
  TrendingUp,
  ArrowRight,
  Plus,
  Play
} from "lucide-react";
import { format } from "date-fns";

const StatCard = ({ title, value, icon: Icon, color, loading }) => (
  <Card className="stat-card border-border/50">
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-16 mt-1" />
          ) : (
            <p className="text-3xl font-bold mt-1">{value}</p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const [stats, setStats] = useState({ total_groups: 0, total_members: 0, total_sessions: 0, total_spins: 0 });
  const [groups, setGroups] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, groupsRes, sessionsRes] = await Promise.all([
          apiClient.get("/stats"),
          apiClient.get("/groups"),
          apiClient.get("/sessions")
        ]);
        setStats(statsRes.data);
        setGroups(groupsRes.data.slice(0, 3));
        setSessions(sessionsRes.data.slice(0, 5));
      } catch (error) {
        console.error("Failed to fetch dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <Layout>
      {/* Welcome section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's what's happening.</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid mb-8" data-testid="stats-grid">
        <StatCard 
          title="Total Groups" 
          value={stats.total_groups} 
          icon={Users} 
          color="bg-gradient-to-br from-blue-500 to-blue-600"
          loading={loading}
        />
        <StatCard 
          title="Total Members" 
          value={stats.total_members} 
          icon={Target} 
          color="bg-gradient-to-br from-emerald-500 to-emerald-600"
          loading={loading}
        />
        <StatCard 
          title="Sessions" 
          value={stats.total_sessions} 
          icon={History} 
          color="bg-gradient-to-br from-violet-500 to-violet-600"
          loading={loading}
        />
        <StatCard 
          title="Total Spins" 
          value={stats.total_spins} 
          icon={TrendingUp} 
          color="bg-gradient-to-br from-amber-500 to-amber-600"
          loading={loading}
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Groups */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Your Groups</CardTitle>
            <Link to="/groups">
              <Button variant="ghost" size="sm" data-testid="view-all-groups">
                View all <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <div className="empty-state py-8">
                <Users className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground mb-4">No groups yet</p>
                <Link to="/groups">
                  <Button data-testid="create-first-group">
                    <Plus className="w-4 h-4 mr-2" /> Create your first group
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((group, index) => (
                  <Link 
                    key={group.id} 
                    to={`/groups/${group.id}`}
                    className="block"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="group-card p-4 rounded-xl border border-border/50 hover:border-primary/50 bg-card">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{group.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {group.member_count} members • {group.currency} {group.contribution_amount}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" asChild>
                          <Link to={`/groups/${group.id}/spin`} data-testid={`spin-group-${group.id}`}>
                            <Play className="w-4 h-4 mr-1" /> Spin
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sessions */}
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Recent Sessions</CardTitle>
            <Link to="/sessions">
              <Button variant="ghost" size="sm" data-testid="view-all-sessions">
                View all <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="empty-state py-8">
                <History className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No sessions yet</p>
                <p className="text-sm text-muted-foreground mt-1">Start a spin session from a group</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((session, index) => (
                  <Link 
                    key={session.id}
                    to={`/sessions/${session.id}/replay`}
                    className="block animate-fade-in-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{session.group_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(session.started_at), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            session.status === "active" 
                              ? "bg-emerald-500/10 text-emerald-500" 
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {session.spin_count} spins
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Dashboard;
