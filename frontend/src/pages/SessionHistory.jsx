import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { apiClient } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { 
  History, 
  Play,
  Calendar,
  Users,
  Target
} from "lucide-react";
import { format } from "date-fns";

const SessionHistory = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await apiClient.get("/sessions");
        setSessions(res.data);
      } catch (error) {
        console.error("Failed to load sessions");
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  return (
    <Layout title="Session History">
      <p className="text-muted-foreground mb-8">View and replay past spin sessions</p>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="empty-state py-16">
            <History className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No sessions yet</h3>
            <p className="text-muted-foreground mb-6">Start a spin session from a group to see history here</p>
            <Link to="/groups">
              <Button>Go to Groups</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((session, index) => (
            <Card 
              key={session.id} 
              className="border-border/50 group-card animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
              data-testid={`session-${session.id}`}
            >
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center">
                      <History className="w-7 h-7 text-violet-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{session.group_name}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(session.started_at), "MMM d, yyyy")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Target className="w-4 h-4" />
                          {session.spin_count} spins
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Badge variant={session.status === "active" ? "default" : "secondary"}>
                      {session.status === "active" ? "In Progress" : "Completed"}
                    </Badge>
                    <Link to={`/sessions/${session.id}/replay`}>
                      <Button variant="outline" data-testid={`replay-session-${session.id}`}>
                        <Play className="w-4 h-4 mr-2" />
                        {session.status === "active" ? "View" : "Replay"}
                      </Button>
                    </Link>
                  </div>
                </div>

                {session.notes && (
                  <p className="text-sm text-muted-foreground mt-4 pl-[4.5rem]">
                    {session.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Layout>
  );
};

export default SessionHistory;
