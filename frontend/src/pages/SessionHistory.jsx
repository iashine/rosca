import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { apiClient } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
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
  Target
} from "lucide-react";
import { format } from "date-fns";

const SessionHistory = () => {
  const [sessions, setSessions] = useState([]);
  const [spinsBySession, setSpinsBySession] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedSpins, setExpandedSpins] = useState({});

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

  // Get cumulative winners up to a specific spin
  const getCumulativeWinners = (spins, upToIndex) => {
    return spins.slice(0, upToIndex).map(s => ({
      name: s.winner_name,
      spin_number: s.spin_number
    }));
  };

  return (
    <Layout title="Spin History">
      <p className="text-muted-foreground mb-8">Complete record of all spins with member tracking</p>

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
            <h3 className="text-xl font-semibold mb-2">No spins recorded yet</h3>
            <p className="text-muted-foreground mb-6">Start a spin session from a group to begin</p>
            <Link to="/groups">
              <Button>Go to Groups</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sessions.map((session) => {
            const spins = spinsBySession[session.id] || [];
            const isComplete = session.status === "completed";
            
            return (
              <Card key={session.id} className="border-border/50" data-testid={`session-${session.id}`}>
                {/* Session Header */}
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        isComplete 
                          ? "bg-gradient-to-br from-emerald-500/20 to-emerald-500/5" 
                          : "bg-gradient-to-br from-amber-500/20 to-amber-500/5"
                      }`}>
                        {isComplete ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        ) : (
                          <Clock className="w-6 h-6 text-amber-500" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{session.group_name}</CardTitle>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(session.started_at), "MMM d, yyyy")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {session.total_members} total members
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isComplete ? "default" : "secondary"}>
                        {isComplete ? "Cycle Complete" : `${session.remaining_members} remaining`}
                      </Badge>
                      {!isComplete && (
                        <Link to={`/groups/${session.group_id}/spin`}>
                          <Button size="sm">
                            <Play className="w-4 h-4 mr-1" /> Continue
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {/* Individual Spin Records */}
                <CardContent>
                  {spins.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No spins recorded yet</p>
                  ) : (
                    <div className="space-y-3 mt-2">
                      {spins.map((spin, index) => {
                        const previousWinners = getCumulativeWinners(spins, index);
                        const membersOnWheel = spin.members_at_spin || [];
                        
                        return (
                          <div 
                            key={spin.id}
                            className="border border-border/50 rounded-xl overflow-hidden bg-card/50"
                            data-testid={`spin-record-${spin.id}`}
                          >
                            {/* Spin Header - Always visible */}
                            <div 
                              className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                              onClick={() => setExpandedSpins(prev => ({
                                ...prev,
                                [spin.id]: !prev[spin.id]
                              }))}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  {/* Spin Number */}
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                                    spin.is_auto_selected 
                                      ? "bg-violet-500/20 text-violet-500"
                                      : "bg-primary/20 text-primary"
                                  }`}>
                                    #{spin.spin_number}
                                  </div>
                                  
                                  {/* Winner Info */}
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <Trophy className="w-4 h-4 text-primary" />
                                      <span className="font-semibold">{spin.winner_name}</span>
                                      {spin.is_auto_selected && (
                                        <Badge variant="secondary" className="text-xs">
                                          <Sparkles className="w-3 h-3 mr-1" />
                                          Auto-selected
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(spin.created_at), "MMM d, yyyy 'at' h:mm:ss a")}
                                    </p>
                                  </div>
                                </div>

                                {/* Quick Stats */}
                                <div className="flex items-center gap-4">
                                  <div className="text-right">
                                    <p className="text-sm font-medium">{membersOnWheel.length} on wheel</p>
                                    <p className="text-xs text-muted-foreground">
                                      {previousWinners.length} previously selected
                                    </p>
                                  </div>
                                  <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${
                                    expandedSpins[spin.id] ? "rotate-90" : ""
                                  }`} />
                                </div>
                              </div>
                            </div>

                            {/* Expanded Details */}
                            {expandedSpins[spin.id] && (
                              <div className="px-4 pb-4 pt-0 border-t border-border/50 bg-muted/20">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                  {/* Members on Wheel */}
                                  <div>
                                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                      <Target className="w-4 h-4 text-blue-500" />
                                      Members on Wheel ({membersOnWheel.length})
                                    </h4>
                                    <div className="flex flex-wrap gap-1">
                                      {membersOnWheel.map((member) => (
                                        <Badge 
                                          key={member.id} 
                                          variant={member.id === spin.winner_member_id ? "default" : "outline"}
                                          className="text-xs"
                                        >
                                          {member.name}
                                          {member.id === spin.winner_member_id && (
                                            <Trophy className="w-3 h-3 ml-1" />
                                          )}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Previously Selected */}
                                  <div>
                                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                      Previously Selected ({previousWinners.length})
                                    </h4>
                                    {previousWinners.length === 0 ? (
                                      <p className="text-xs text-muted-foreground">First spin - no previous winners</p>
                                    ) : (
                                      <div className="flex flex-wrap gap-1">
                                        {previousWinners.map((winner, idx) => (
                                          <Badge key={idx} variant="secondary" className="text-xs">
                                            #{winner.spin_number} {winner.name}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Progression Summary */}
                                <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                                  <p className="text-sm">
                                    <span className="font-medium">Spin #{spin.spin_number}:</span>{" "}
                                    {membersOnWheel.length} members competed → <span className="text-primary font-medium">{spin.winner_name}</span> won
                                    {index < spins.length - 1 && (
                                      <span className="text-muted-foreground">
                                        {" "}→ {membersOnWheel.length - 1} members continue to next spin
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Cycle Summary */}
                  {spins.length > 0 && (
                    <div className="mt-4 p-4 bg-muted/30 rounded-xl">
                      <h4 className="text-sm font-medium mb-2">Selection Order</h4>
                      <div className="flex flex-wrap gap-2">
                        {spins.map((spin, idx) => (
                          <div key={spin.id} className="flex items-center">
                            <Badge variant={spin.is_auto_selected ? "secondary" : "default"} className="text-xs">
                              #{spin.spin_number} {spin.winner_name}
                            </Badge>
                            {idx < spins.length - 1 && (
                              <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
                            )}
                          </div>
                        ))}
                      </div>
                      {isComplete && (
                        <div className="mt-3 flex items-center gap-2">
                          <Link to={`/sessions/${session.id}/replay`}>
                            <Button size="sm" variant="outline">
                              <Play className="w-4 h-4 mr-1" /> Watch Replay
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
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
