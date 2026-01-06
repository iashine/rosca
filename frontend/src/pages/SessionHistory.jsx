import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { apiClient, useTheme } from "../App";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import confetti from "canvas-confetti";
import { 
  History, 
  Play,
  Calendar,
  Users,
  Trophy,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  X
} from "lucide-react";
import { format } from "date-fns";

const SessionHistory = () => {
  const { wheelTheme, loadWheelTheme } = useTheme();
  const [sessions, setSessions] = useState([]);
  const [spinsBySession, setSpinsBySession] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Replay state
  const [replayingSpin, setReplayingSpin] = useState(null);
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const [showWinner, setShowWinner] = useState(false);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sessionsRes = await apiClient.get("/sessions");
        setSessions(sessionsRes.data);
        await loadWheelTheme();
        
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
  }, [loadWheelTheme]);

  // Draw wheel function
  const drawWheel = useCallback((canvas, members, rotation, highlightWinnerId = null) => {
    if (!canvas || members.length === 0) return;

    const ctx = canvas.getContext("2d");
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 15;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sliceAngle = (2 * Math.PI) / members.length;
    const colors = wheelTheme.wheel_colors;

    members.forEach((member, index) => {
      const startAngle = index * sliceAngle + (rotation * Math.PI) / 180;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = colors[index % colors.length];
      ctx.fill();

      const isWinner = member.id === highlightWinnerId;
      ctx.strokeStyle = isWinner ? "#22c55e" : "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = isWinner ? 4 : 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.max(10, Math.min(14, 160 / members.length))}px 'Outfit', sans-serif`;
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 2;
      
      let displayName = member.name;
      if (displayName.length > 10) {
        displayName = displayName.substring(0, 8) + "...";
      }
      
      ctx.fillText(displayName, radius - 15, 4);
      ctx.restore();
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 3;
    ctx.stroke();
  }, [wheelTheme.wheel_colors]);

  // Play replay for a specific spin
  const playReplay = useCallback((spin) => {
    setReplayingSpin(spin);
    setShowWinner(false);
    setIsWheelSpinning(true);

    // Wait for dialog to open and canvas to be ready
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas || !spin.members_at_spin || spin.members_at_spin.length === 0) {
        setIsWheelSpinning(false);
        setShowWinner(true);
        return;
      }

      const members = spin.members_at_spin;
      const targetAngle = spin.spin_angle || 0;
      
      // If auto-selected, just show the result
      if (spin.is_auto_selected) {
        drawWheel(canvas, members, 0, spin.winner_member_id);
        setIsWheelSpinning(false);
        setShowWinner(true);
        return;
      }

      let currentRotation = 0;
      const duration = 3500;
      const startTime = Date.now();
      const extraRotations = 3 * 360;
      const totalRotation = extraRotations + targetAngle;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        
        currentRotation = totalRotation * easeOut;
        drawWheel(canvas, members, currentRotation);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setIsWheelSpinning(false);
          setShowWinner(true);
          drawWheel(canvas, members, currentRotation, spin.winner_member_id);
          
          confetti({
            particleCount: 60,
            spread: 50,
            origin: { y: 0.6 },
            colors: wheelTheme.wheel_colors
          });
        }
      };

      drawWheel(canvas, members, 0);
      animationRef.current = requestAnimationFrame(animate);
    }, 100);
  }, [drawWheel, wheelTheme.wheel_colors]);

  const closeReplay = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setReplayingSpin(null);
    setIsWheelSpinning(false);
    setShowWinner(false);
  };

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
                  {!isComplete && (
                    <Link to={`/groups/${session.group_id}/spin`}>
                      <Button size="sm">
                        <Play className="w-4 h-4 mr-1" /> Continue
                      </Button>
                    </Link>
                  )}
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
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground w-32">Time</th>
                            <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground w-24">Replay</th>
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

                                {/* Replay Button */}
                                <td className="py-3 px-4 text-center">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => playReplay(spin)}
                                    data-testid={`replay-spin-${spin.id}`}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Play className="w-4 h-4" />
                                  </Button>
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

      {/* Replay Modal */}
      <Dialog open={!!replayingSpin} onOpenChange={(open) => !open && closeReplay()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Spin #{replayingSpin?.spin_number} Replay
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center py-4">
            {/* Arrow pointer */}
            <div className="mb-1">
              <svg width="30" height="30" viewBox="0 0 30 30">
                <polygon 
                  points="15,25 7,7 23,7" 
                  fill="#3b82f6"
                  stroke="#1e293b"
                  strokeWidth="2"
                />
              </svg>
            </div>

            {/* Wheel canvas */}
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={280}
                height={280}
                className="rounded-full"
              />
            </div>

            {/* Winner announcement */}
            {showWinner && replayingSpin && (
              <div className="mt-4 text-center animate-fade-in-up">
                <p className="text-sm text-muted-foreground mb-1">
                  {replayingSpin.is_auto_selected ? "Auto-selected" : "Winner"}
                </p>
                <h3 className="text-xl font-bold text-primary flex items-center justify-center gap-2">
                  <Trophy className="w-5 h-5" />
                  {replayingSpin.winner_name}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(replayingSpin.created_at), "MMM d, yyyy 'at' h:mm:ss a")}
                </p>
              </div>
            )}

            {isWheelSpinning && (
              <p className="mt-4 text-sm text-muted-foreground animate-pulse">
                Spinning...
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default SessionHistory;
