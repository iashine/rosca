import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { apiClient, useTheme } from "../App";
import SpinWheel from "../components/SpinWheel";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { ScrollArea } from "../components/ui/scroll-area";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Trophy,
  Users,
  Loader2,
  RotateCcw,
  CheckCircle2,
  Clock,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";

const SpinSession = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { wheelTheme, loadWheelTheme } = useTheme();
  
  const [group, setGroup] = useState(null);
  const [allMembers, setAllMembers] = useState([]);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [session, setSession] = useState(null);
  const [spinResults, setSpinResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [currentWinner, setCurrentWinner] = useState(null);
  const [countdown, setCountdown] = useState(0);

  const fetchGroupData = useCallback(async () => {
    try {
      const [groupRes, membersRes] = await Promise.all([
        apiClient.get(`/groups/${groupId}`),
        apiClient.get(`/groups/${groupId}/members`)
      ]);
      setGroup(groupRes.data);
      setAllMembers(membersRes.data);
      await loadWheelTheme();
    } catch (error) {
      toast.error("Failed to load group");
      navigate("/groups");
    }
  }, [groupId, navigate, loadWheelTheme]);

  const checkActiveSession = useCallback(async () => {
    try {
      const res = await apiClient.get(`/groups/${groupId}/active-session`);
      
      if (res.data.session) {
        // Continue existing session
        setSession(res.data.session);
        setAvailableMembers(res.data.remaining_members);
        setSpinResults(res.data.winners);
        
        if (res.data.session.status === "completed" || res.data.remaining_members.length === 0) {
          setSessionComplete(true);
        }
      } else {
        // No active session - will need to start one
        setSession(null);
        setAvailableMembers([]);
        setSpinResults([]);
      }
    } catch (error) {
      console.error("Failed to check active session");
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    const init = async () => {
      await fetchGroupData();
      await checkActiveSession();
    };
    init();
  }, [fetchGroupData, checkActiveSession]);

  const startNewCycle = async () => {
    try {
      const res = await apiClient.post(`/groups/${groupId}/sessions`);
      setSession(res.data);
      setAvailableMembers([...allMembers]);
      setSpinResults([]);
      setSessionComplete(false);
      toast.success("New ROSCA cycle started!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to start session");
    }
  };

  const handleSpinEnd = async (winner, spinAngle, randomSeed) => {
    if (!session) return;

    try {
      // Record the spin with all members present
      const res = await apiClient.post("/spins", {
        session_id: session.id,
        winner_member_id: winner.id,
        winner_name: winner.name,
        members_at_spin: availableMembers.map(m => ({ id: m.id, name: m.name })),
        spin_angle: spinAngle,
        random_seed: randomSeed,
        is_auto_selected: false
      });

      // Add to results list
      setSpinResults(prev => [...prev, res.data]);
      
      // Show winner and start countdown
      setCurrentWinner(winner);
      setCountdown(10);

      toast.success(`${winner.name} wins!`, {
        description: `Spin #${res.data.spin_number} - Removing in 10 seconds...`,
        icon: <Trophy className="w-4 h-4 text-primary" />,
        duration: 10000
      });

      // Countdown and remove after 10 seconds
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Remove winner after 10 seconds
      setTimeout(() => {
        setCurrentWinner(null);
        const newAvailable = availableMembers.filter(m => m.id !== winner.id);
        setAvailableMembers(newAvailable);

        // Check if only 1 member left - auto-select them as last winner
        if (newAvailable.length === 1) {
          autoSelectLastMember(newAvailable[0]);
        } else if (newAvailable.length === 0) {
          // Session complete
          setSessionComplete(true);
          toast.success("🎉 ROSCA cycle complete! All members have been selected.");
        }
      }, 10000);
    } catch (error) {
      toast.error("Failed to record spin");
    }
  };

  const autoSelectLastMember = async (lastMember) => {
    if (!session) return;

    try {
      // Auto-record the last member
      const res = await apiClient.post("/spins", {
        session_id: session.id,
        winner_member_id: lastMember.id,
        winner_name: lastMember.name,
        members_at_spin: [{ id: lastMember.id, name: lastMember.name }],
        spin_angle: 0,
        random_seed: "auto-selected",
        is_auto_selected: true
      });

      setSpinResults(prev => [...prev, res.data]);
      setAvailableMembers([]);
      setSessionComplete(true);

      toast.success(`${lastMember.name} auto-selected as final winner!`, {
        description: "ROSCA cycle complete!",
        icon: <Sparkles className="w-4 h-4 text-primary" />
      });
    } catch (error) {
      toast.error("Failed to auto-select last member");
    }
  };

  const resetCycle = () => {
    // This just resets the UI to allow starting a new cycle
    setSession(null);
    setAvailableMembers([]);
    setSpinResults([]);
    setSessionComplete(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const progress = session ? ((spinResults.length / session.total_members) * 100) : 0;

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to={`/groups/${groupId}`}>
            <Button variant="ghost" size="icon" data-testid="back-to-group">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{group?.name}</h1>
            <p className="text-muted-foreground">
              {session ? (
                sessionComplete ? "Cycle Complete" : `Cycle in Progress - ${availableMembers.length} remaining`
              ) : (
                "Start a new ROSCA cycle"
              )}
            </p>
          </div>
        </div>
        {session && (
          <Badge variant={sessionComplete ? "default" : "secondary"} className="text-sm px-3 py-1">
            {sessionComplete ? (
              <><CheckCircle2 className="w-4 h-4 mr-1" /> Completed</>
            ) : (
              <><Clock className="w-4 h-4 mr-1" /> In Progress</>
            )}
          </Badge>
        )}
      </div>

      {/* Progress bar */}
      {session && (
        <Card className="border-border/50 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Cycle Progress</span>
              <span className="text-sm text-muted-foreground">
                {spinResults.length} of {session.total_members} members selected
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {!session ? (
        // No active session - show start options
        <Card className="border-border/50 max-w-lg mx-auto">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-6">
              <Users className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Start New ROSCA Cycle</h2>
            <p className="text-muted-foreground mb-6">
              {allMembers.length} members in this group. Each member will be selected once until the cycle completes.
            </p>
            <Button 
              className="spin-button px-8" 
              onClick={startNewCycle}
              disabled={allMembers.length < 2}
              data-testid="start-cycle-btn"
            >
              Start New Cycle
            </Button>
            {allMembers.length < 2 && (
              <p className="text-sm text-destructive mt-4">
                Add at least 2 members to start a cycle
              </p>
            )}
          </CardContent>
        </Card>
      ) : sessionComplete ? (
        // Session complete - show summary
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <Card className="border-border/50">
              <CardContent className="p-8 text-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-6">
                  <Trophy className="w-12 h-12 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Cycle Complete! 🎉</h2>
                <p className="text-muted-foreground mb-6">
                  All {session.total_members} members have been selected in this ROSCA cycle.
                </p>
                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={resetCycle} data-testid="new-cycle-btn">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Start New Cycle
                  </Button>
                  <Link to={`/sessions/${session.id}/replay`}>
                    <Button data-testid="view-replay-btn">
                      View Replay
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results sidebar */}
          <div className="lg:col-span-4">
            <Card className="border-border/50 h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Selection Order ({spinResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {spinResults.map((result, index) => (
                      <div
                        key={result.id}
                        className="result-item p-4 rounded-xl border border-border/50 bg-card"
                        data-testid={`spin-result-${index}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                            <span className="font-bold text-primary">#{result.spin_number}</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">{result.winner_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {result.is_auto_selected ? "Auto-selected" : format(new Date(result.created_at), "h:mm:ss a")}
                            </p>
                          </div>
                          {result.is_auto_selected && (
                            <Badge variant="secondary" className="text-xs">Last</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        // Session in progress - show wheel
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Wheel Section */}
          <div className="lg:col-span-8 relative">
            <div className="floating-shapes rounded-3xl" />
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-8 flex flex-col items-center">
                <SpinWheel
                  key={availableMembers.map(m => m.id).join(',')}
                  members={availableMembers}
                  wheelColors={wheelTheme.wheel_colors}
                  onSpinEnd={handleSpinEnd}
                  isSpinning={isSpinning}
                  setIsSpinning={setIsSpinning}
                />
                
                <div className="mt-6 flex items-center gap-4">
                  <Button
                    className="spin-button px-8 py-6 text-lg"
                    onClick={() => {
                      const wheel = document.querySelector('[data-testid="spin-wheel"]');
                      if (wheel) wheel.click();
                    }}
                    disabled={isSpinning || availableMembers.length === 0}
                    data-testid="spin-btn"
                  >
                    {isSpinning ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Spinning...
                      </>
                    ) : availableMembers.length === 0 ? (
                      "Cycle Complete!"
                    ) : availableMembers.length === 1 ? (
                      "Auto-selecting last member..."
                    ) : (
                      "SPIN THE WHEEL"
                    )}
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground mt-4">
                  {availableMembers.length} members remaining in this cycle
                </p>

                {/* Show members on wheel */}
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {availableMembers.map((member) => (
                    <Badge key={member.id} variant="outline" className="text-xs">
                      {member.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-4">
            <Card className="border-border/50 h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Selected ({spinResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {spinResults.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Spin the wheel to select members
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-3">
                      {spinResults.map((result, index) => (
                        <div
                          key={result.id}
                          className="result-item p-4 rounded-xl border border-border/50 bg-card"
                          data-testid={`spin-result-${index}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center">
                              <span className="font-bold text-amber-500">#{result.spin_number}</span>
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold">{result.winner_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {result.is_auto_selected ? "Auto-selected" : format(new Date(result.created_at), "h:mm:ss a")}
                              </p>
                            </div>
                            {result.is_auto_selected && (
                              <Badge variant="secondary" className="text-xs">Last</Badge>
                            )}
                          </div>
                          {/* Show who was on the wheel */}
                          {result.members_at_spin && result.members_at_spin.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              <p className="text-xs text-muted-foreground">
                                On wheel: {result.members_at_spin.map(m => m.name).join(", ")}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default SpinSession;
