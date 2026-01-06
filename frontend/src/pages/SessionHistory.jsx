import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { apiClient } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { 
  History, 
  Play,
  Calendar,
  Users,
  Target,
  CheckCircle2,
  Clock
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
    <Layout title="ROSCA Cycles">
      <p className="text-muted-foreground mb-8">View and replay past ROSCA cycles</p>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="empty-state py-16">
            <History className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No cycles yet</h3>
            <p className="text-muted-foreground mb-6">Start a spin session from a group to begin a ROSCA cycle</p>
            <Link to="/groups">
              <Button>Go to Groups</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((session, index) => {
            const progress = (session.spin_count / session.total_members) * 100;
            const isComplete = session.status === "completed";
            
            return (
              <Card 
                key={session.id} 
                className="border-border/50 group-card animate-fade-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
                data-testid={`session-${session.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4">
                    {/* Header row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                          isComplete 
                            ? "bg-gradient-to-br from-emerald-500/20 to-emerald-500/5" 
                            : "bg-gradient-to-br from-amber-500/20 to-amber-500/5"
                        }`}>
                          {isComplete ? (
                            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                          ) : (
                            <Clock className="w-7 h-7 text-amber-500" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{session.group_name}</h3>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {format(new Date(session.started_at), "MMM d, yyyy")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {session.total_members} members
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Badge variant={isComplete ? "default" : "secondary"}>
                          {isComplete ? "Completed" : "In Progress"}
                        </Badge>
                        <Link to={isComplete ? `/sessions/${session.id}/replay` : `/groups/${session.group_id}/spin`}>
                          <Button variant="outline" data-testid={`view-session-${session.id}`}>
                            <Play className="w-4 h-4 mr-2" />
                            {isComplete ? "Replay" : "Continue"}
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                          {session.spin_count} of {session.total_members} selected
                          {!isComplete && session.remaining_members > 0 && (
                            <span className="text-muted-foreground ml-1">
                              ({session.remaining_members} remaining)
                            </span>
                          )}
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    {/* Completion info */}
                    {isComplete && session.completed_at && (
                      <p className="text-sm text-muted-foreground">
                        Completed on {format(new Date(session.completed_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </Layout>
  );
};

export default SessionHistory;
