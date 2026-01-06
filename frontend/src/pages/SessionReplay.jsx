import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { apiClient, useTheme } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import confetti from "canvas-confetti";
import { 
  ArrowLeft,
  Trophy,
  Calendar,
  Clock,
  Play,
  Pause,
  RotateCcw,
  FastForward
} from "lucide-react";
import { format } from "date-fns";

const SessionReplay = () => {
  const { sessionId } = useParams();
  const { wheelTheme, loadWheelTheme } = useTheme();
  const [session, setSession] = useState(null);
  const [spinResults, setSpinResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replayIndex, setReplayIndex] = useState(-1);
  const [isReplaying, setIsReplaying] = useState(false);
  const [currentWinner, setCurrentWinner] = useState(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // Fetch session data
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const [sessionRes, spinsRes] = await Promise.all([
          apiClient.get(`/sessions/${sessionId}`),
          apiClient.get(`/sessions/${sessionId}/spins`)
        ]);
        setSession(sessionRes.data);
        setSpinResults(spinsRes.data);
        await loadWheelTheme();
      } catch (error) {
        console.error("Failed to load session");
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId, loadWheelTheme]);

  // Generate member names from spin results (reconstructing the original wheel)
  const getWheelMembers = useCallback(() => {
    // Create a list of all winners - they were the original members
    return spinResults.map(spin => ({
      id: spin.winner_member_id,
      name: spin.winner_name
    }));
  }, [spinResults]);

  // Draw the wheel
  const drawWheel = useCallback((members, rotation, highlightIndex = -1) => {
    const canvas = canvasRef.current;
    if (!canvas || members.length === 0) return;

    const ctx = canvas.getContext("2d");
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sliceAngle = (2 * Math.PI) / members.length;
    const colors = wheelTheme.wheel_colors;

    members.forEach((member, index) => {
      const startAngle = index * sliceAngle + (rotation * Math.PI) / 180;
      const endAngle = startAngle + sliceAngle;

      // Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      // Fill with color (highlight winner)
      ctx.fillStyle = colors[index % colors.length];
      ctx.fill();

      // Add border
      ctx.strokeStyle = highlightIndex === index ? "#fbbf24" : "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = highlightIndex === index ? 4 : 2;
      ctx.stroke();

      // Draw text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.max(12, Math.min(16, 200 / members.length))}px 'Outfit', sans-serif`;
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 3;
      
      let displayName = member.name;
      if (displayName.length > 12) {
        displayName = displayName.substring(0, 10) + "...";
      }
      
      ctx.fillText(displayName, radius - 20, 5);
      ctx.restore();
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Draw center text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SPIN", centerX, centerY);
  }, [wheelTheme.wheel_colors]);

  // Initial wheel draw
  useEffect(() => {
    const members = getWheelMembers();
    if (members.length > 0) {
      drawWheel(members, 0);
    }
  }, [spinResults, drawWheel, getWheelMembers]);

  // Animate wheel to a specific spin result
  const animateToSpin = useCallback((spinIndex) => {
    if (spinIndex < 0 || spinIndex >= spinResults.length) return;

    const spin = spinResults[spinIndex];
    const members = getWheelMembers();
    const targetAngle = spin.spin_angle;

    setIsWheelSpinning(true);
    setCurrentWinner(null);

    const startRotation = wheelRotation;
    const duration = 4000;
    const startTime = Date.now();

    // Add extra rotations for visual effect
    const extraRotations = 3 * 360;
    const totalRotation = startRotation + extraRotations + (targetAngle - (startRotation % 360) + 360) % 360;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out cubic)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentRotation = startRotation + (totalRotation - startRotation) * easeOut;
      setWheelRotation(currentRotation);
      drawWheel(members, currentRotation);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
        setIsWheelSpinning(false);
        setCurrentWinner(spin);
        
        // Find winner index and highlight
        const winnerIndex = members.findIndex(m => m.id === spin.winner_member_id);
        drawWheel(members, currentRotation, winnerIndex);
        
        // Fire confetti
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: wheelTheme.wheel_colors
        });
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [spinResults, wheelRotation, drawWheel, getWheelMembers, wheelTheme.wheel_colors]);

  // Handle replay sequence
  useEffect(() => {
    if (isReplaying && !isWheelSpinning && replayIndex < spinResults.length) {
      if (replayIndex === -1) {
        // Start first spin after a brief delay
        const timer = setTimeout(() => {
          setReplayIndex(0);
        }, 500);
        return () => clearTimeout(timer);
      } else {
        // Animate current spin
        animateToSpin(replayIndex);
      }
    }
  }, [isReplaying, replayIndex, isWheelSpinning, spinResults.length, animateToSpin]);

  // Move to next spin after current animation completes
  useEffect(() => {
    if (isReplaying && !isWheelSpinning && currentWinner && replayIndex >= 0) {
      if (replayIndex < spinResults.length - 1) {
        const timer = setTimeout(() => {
          setReplayIndex(prev => prev + 1);
          setCurrentWinner(null);
        }, 2000);
        return () => clearTimeout(timer);
      } else {
        // Replay complete
        setIsReplaying(false);
      }
    }
  }, [isReplaying, isWheelSpinning, currentWinner, replayIndex, spinResults.length]);

  const startReplay = () => {
    // Cancel any ongoing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    // Reset state
    setWheelRotation(0);
    setReplayIndex(-1);
    setCurrentWinner(null);
    setIsReplaying(true);
    
    // Redraw wheel at starting position
    const members = getWheelMembers();
    drawWheel(members, 0);
  };

  const pauseReplay = () => {
    setIsReplaying(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  const resetReplay = () => {
    pauseReplay();
    setWheelRotation(0);
    setReplayIndex(-1);
    setCurrentWinner(null);
    const members = getWheelMembers();
    drawWheel(members, 0);
  };

  const skipToSpin = (index) => {
    pauseReplay();
    setReplayIndex(index);
    animateToSpin(index);
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

  if (!session) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Session not found</p>
          <Link to="/sessions" className="mt-4 inline-block">
            <Button>Back to Sessions</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const wheelMembers = getWheelMembers();

  return (
    <Layout>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/sessions">
          <Button variant="ghost" size="icon" data-testid="back-to-sessions">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{session.group_name}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(session.started_at), "MMMM d, yyyy")}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {format(new Date(session.started_at), "h:mm a")}
            </span>
          </div>
        </div>
        <Badge variant={session.status === "active" ? "default" : "secondary"}>
          {session.status === "active" ? "In Progress" : "Completed"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Wheel Replay Section */}
        <div className="lg:col-span-8">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Session Replay</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetReplay}
                    disabled={isWheelSpinning}
                    data-testid="reset-replay-btn"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={isReplaying ? pauseReplay : startReplay}
                    disabled={spinResults.length === 0 || isWheelSpinning}
                    data-testid="replay-btn"
                  >
                    {isReplaying ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" /> {replayIndex >= 0 ? "Resume" : "Start Replay"}
                      </>
                    )}
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {spinResults.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No spins recorded in this session</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  {/* Arrow pointer */}
                  <div className="mb-2">
                    <svg width="40" height="40" viewBox="0 0 40 40">
                      <polygon 
                        points="20,35 10,10 30,10" 
                        fill="#3b82f6"
                        stroke="#1e293b"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>

                  {/* Wheel canvas */}
                  <div className="relative wheel-glow rounded-full">
                    <canvas
                      ref={canvasRef}
                      width={350}
                      height={350}
                      className="rounded-full"
                      data-testid="replay-wheel"
                    />
                  </div>

                  {/* Current winner announcement */}
                  {currentWinner && (
                    <div className="mt-6 winner-card winner-display rounded-2xl p-6 text-center animate-fade-in-up">
                      <p className="text-sm text-muted-foreground mb-1 uppercase tracking-wider">
                        Spin #{currentWinner.spin_number} Winner
                      </p>
                      <h2 className="text-2xl font-bold text-amber-500" data-testid="current-winner-name">
                        {currentWinner.winner_name}
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(currentWinner.created_at), "h:mm:ss a")}
                      </p>
                    </div>
                  )}

                  {/* Progress indicator */}
                  <div className="mt-4 text-sm text-muted-foreground">
                    {replayIndex >= 0 ? (
                      <span>Spin {Math.min(replayIndex + 1, spinResults.length)} of {spinResults.length}</span>
                    ) : (
                      <span>Ready to replay {spinResults.length} spins</span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Results Timeline */}
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
                  <p className="text-muted-foreground">No spins recorded</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {spinResults.map((result, index) => (
                      <button
                        key={result.id}
                        onClick={() => skipToSpin(index)}
                        disabled={isWheelSpinning}
                        className={`w-full text-left relative flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 hover:border-primary/50 ${
                          replayIndex === index 
                            ? "border-amber-500/50 bg-amber-500/10" 
                            : replayIndex > index
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-border/50 bg-card"
                        }`}
                        data-testid={`replay-result-${index}`}
                      >
                        {/* Timeline line */}
                        {index < spinResults.length - 1 && (
                          <div className={`absolute left-[2.1rem] top-[4rem] w-0.5 h-6 transition-colors duration-500 ${
                            replayIndex > index ? "bg-emerald-500/50" : "bg-border"
                          }`} />
                        )}
                        
                        {/* Spin number badge */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                          replayIndex === index 
                            ? "bg-amber-500 text-white" 
                            : replayIndex > index
                            ? "bg-emerald-500 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {result.spin_number}
                        </div>
                        
                        {/* Result info */}
                        <div className="flex-1">
                          <p className={`font-semibold transition-colors duration-300 ${
                            replayIndex >= index ? "text-foreground" : "text-muted-foreground"
                          }`}>
                            {result.winner_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(result.created_at), "h:mm:ss a")}
                          </p>
                        </div>

                        {/* Skip to icon */}
                        <FastForward className={`w-4 h-4 transition-opacity ${
                          replayIndex === index ? "opacity-0" : "opacity-50 hover:opacity-100"
                        }`} />
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default SessionReplay;
