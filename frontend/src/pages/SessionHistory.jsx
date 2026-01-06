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
  Trophy,
  CheckCircle2,
  Clock,
  ChevronRight,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { format } from "date-fns";

const SessionHistory = () => {
  const [sessions, setSessions] = useState([]);
  const [spinsBySession, setSpinsBySession] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sessionsRes = await apiClient.get("/sessions");
        setSessions(sessionsRes.data);
        
        // Fetch spins for each session
        const spinsData = {};
        for (const session of sessionsRes.data) {
          try {
            const spinsRes = await apiClient.get(`/sessions/${session.id}/spins`);
            spinsData[session.id] = spinsRes.data;
          } catch (e) {
            spinsData[session.id] = [];
          }
        }
        setSpinsBySession(spinsData);
      } catch (error) {
        console.error("Failed to load sessions");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <Layout title="Spin History">
      <p className="text-muted-foreground mb-8">Complete record of all spins</p>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="empty-state py-16">
            <History className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No spins recorded yet</h3>
            <p className="text-muted-foreground mb-6">Start a spin session from a group to begin</p>
            <Link to="/groups">
              <Button>Go to Groups</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {sessions.map((session) => {
            const spins = spinsBySession[session.id] || [];
            const isComplete = session.status === "completed";
            
            return (
              <div key={session.id} data-testid={`session-${session.id}`}>
                {/* Session Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isComplete 
                        ? "bg-emerald-500/20" 
                        : "bg-primary/20"
                    }`}>
                      {isComplete ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{session.group_name}</h2>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(session.started_at), "MMM d, yyyy")}
                        <span>•</span>
                        <Users className="w-4 h-4" />
                        {session.total_members} members
                        <span>•</span>
                        <Badge variant={isComplete ? "default" : "secondary"} className="text-xs">
                          {isComplete ? "Complete" : `${session.remaining_members} left`}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isComplete ? (
                      <Link to={`/sessions/${session.id}/replay`}>
                        <Button variant="outline" size="sm">
                          <Play className="w-4 h-4 mr-1" /> Replay
                        </Button>
                      </Link>
                    ) : (
                      <Link to={`/groups/${session.group_id}/spin`}>
                        <Button size="sm">
                          <Play className="w-4 h-4 mr-1" /> Continue
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Spins Table */}
                {spins.length === 0 ? (
                  <Card className="border-border/50">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No spins recorded yet
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-border/50 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground w-16">#</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Winner</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Members on Wheel</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Previously Selected</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground w-40">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {spins.map((spin, index) => {
                            const previousWinners = spins.slice(0, index).map(s => s.winner_name);
                            const membersOnWheel = spin.members_at_spin || [];
                            
                            return (
                              <tr 
                                key={spin.id} 
                                className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                                data-testid={`spin-row-${spin.id}`}
                              >
                                {/* Spin Number */}
                                <td className="py-3 px-4">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                    spin.is_auto_selected 
                                      ? "bg-violet-500/20 text-violet-500"
                                      : "bg-primary/20 text-primary"
                                  }`}>
                                    {spin.spin_number}
                                  </div>
                                </td>
                                
                                {/* Winner */}
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <Trophy className="w-4 h-4 text-primary" />
                                    <span className="font-medium">{spin.winner_name}</span>
                                    {spin.is_auto_selected && (
                                      <Badge variant="secondary" className="text-xs">
                                        <Sparkles className="w-3 h-3 mr-1" />
                                        Auto
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                
                                {/* Members on Wheel */}
                                <td className="py-3 px-4">
                                  <div className="flex flex-wrap gap-1">
                                    {membersOnWheel.length > 0 ? (
                                      membersOnWheel.map((member) => (
                                        <Badge 
                                          key={member.id} 
                                          variant={member.id === spin.winner_member_id ? "default" : "outline"}
                                          className="text-xs"
                                        >
                                          {member.name}
                                        </Badge>
                                      ))
                                    ) : (
                                      <span className="text-sm text-muted-foreground">-</span>
                                    )}
                                  </div>
                                </td>
                                
                                {/* Previously Selected */}
                                <td className="py-3 px-4">
                                  {previousWinners.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {previousWinners.map((name, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600">
                                          {name}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">First spin</span>
                                  )}
                                </td>
                                
                                {/* Time */}
                                <td className="py-3 px-4 text-sm text-muted-foreground">
                                  {format(new Date(spin.created_at), "h:mm:ss a")}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Quick Summary Footer */}
                    <div className="px-4 py-3 bg-muted/20 border-t border-border/50">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Selection order:</span>
                        {spins.map((spin, idx) => (
                          <span key={spin.id} className="flex items-center">
                            <span className={`font-medium ${spin.is_auto_selected ? "text-violet-500" : "text-foreground"}`}>
                              {spin.winner_name}
                            </span>
                            {idx < spins.length - 1 && (
                              <ArrowRight className="w-3 h-3 mx-1 text-muted-foreground" />
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
};

export default SessionHistory;
