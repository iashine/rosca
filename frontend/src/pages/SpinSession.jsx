import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { apiClient, useTheme } from "../App";
import SpinWheel from "../components/SpinWheel";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { ScrollArea } from "../components/ui/scroll-area";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Trophy,
  Users,
  StopCircle,
  Loader2,
  RotateCcw
} from "lucide-react";
import { format } from "date-fns";

const SpinSession = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { wheelTheme, loadWheelTheme } = useTheme();
  
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [availableMembers, setAvailableMembers] = useState([]);
  const [session, setSession] = useState(null);
  const [spinResults, setSpinResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [endingSession, setEndingSession] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [groupRes, membersRes] = await Promise.all([
        apiClient.get(`/groups/${groupId}`),
        apiClient.get(`/groups/${groupId}/members`)
      ]);
      setGroup(groupRes.data);
      setMembers(membersRes.data);
      setAvailableMembers(membersRes.data);
      await loadWheelTheme();
    } catch (error) {
      toast.error("Failed to load group");
      navigate("/groups");
    } finally {
      setLoading(false);
    }
  }, [groupId, navigate, loadWheelTheme]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const startSession = async () => {
    try {
      const res = await apiClient.post("/sessions", {
        group_id: groupId,
        notes: ""
      });
      setSession(res.data);
      setSpinResults([]);
      setAvailableMembers([...members]);
      toast.success("Session started!");
    } catch (error) {
      toast.error("Failed to start session");
    }
  };

  const handleSpinEnd = async (winner, spinAngle, randomSeed) => {
    if (!session) return;

    try {
      // Record the spin result
      const res = await apiClient.post("/spins", {
        session_id: session.id,
        winner_member_id: winner.id,
        winner_name: winner.name,
        spin_angle: spinAngle,
        random_seed: randomSeed
      });

      // Add to results list
      setSpinResults(prev => [...prev, res.data]);

      // Remove winner from available members (don't spin same person twice)
      setAvailableMembers(prev => prev.filter(m => m.id !== winner.id));

      toast.success(`${winner.name} wins!`, {
        description: `Spin #${res.data.spin_number}`,
        icon: <Trophy className="w-4 h-4 text-amber-500" />
      });
    } catch (error) {
      toast.error("Failed to record spin");
    }
  };

  const handleEndSession = async () => {
    if (!session) return;

    setEndingSession(true);
    try {
      await apiClient.post(`/sessions/${session.id}/end`);
      toast.success("Session ended!");
      navigate(`/sessions/${session.id}/replay`);
    } catch (error) {
      toast.error("Failed to end session");
    } finally {
      setEndingSession(false);
    }
  };

  const resetWheel = () => {
    setAvailableMembers([...members]);
    toast.info("Wheel reset with all members");
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
              {session ? "Session in progress" : "Start a spin session"}
            </p>
          </div>
        </div>
        {session && (
          <Button 
            variant="destructive" 
            onClick={handleEndSession}
            disabled={endingSession}
            data-testid="end-session-btn"
          >
            {endingSession ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <StopCircle className="w-4 h-4 mr-2" />
            )}
            End Session
          </Button>
        )}
      </div>

      {!session ? (
        // Session not started
        <Card className="border-border/50 max-w-lg mx-auto">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-6">
              <Users className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Ready to Spin?</h2>
            <p className="text-muted-foreground mb-6">
              {members.length} members in this group. Start a session to begin the wheel spin.
            </p>
            <Button 
              className="spin-button px-8" 
              onClick={startSession}
              disabled={members.length === 0}
              data-testid="start-session-btn"
            >
              Start Session
            </Button>
            {members.length === 0 && (
              <p className="text-sm text-destructive mt-4">
                Add members to the group first
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        // Session in progress
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Wheel Section */}
          <div className="lg:col-span-8 relative">
            <div className="floating-shapes rounded-3xl" />
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-8 flex flex-col items-center">
                <SpinWheel
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
                      "All members selected!"
                    ) : (
                      "SPIN THE WHEEL"
                    )}
                  </Button>
                  
                  {spinResults.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={resetWheel}
                      data-testid="reset-wheel-btn"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset
                    </Button>
                  )}
                </div>

                <p className="text-sm text-muted-foreground mt-4">
                  {availableMembers.length} members remaining
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-4">
            <Card className="border-border/50 h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Results ({spinResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {spinResults.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Spin the wheel to see results
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
                            <div>
                              <p className="font-semibold">{result.winner_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(result.created_at), "h:mm:ss a")}
                              </p>
                            </div>
                          </div>
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
