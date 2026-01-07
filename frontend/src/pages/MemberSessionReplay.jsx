import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Progress } from "../components/ui/progress";
import confetti from "canvas-confetti";
import { 
  ArrowLeft,
  Trophy,
  Calendar,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Users,
  Sparkles,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Default wheel colors - same as admin version
const DEFAULT_WHEEL_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#0ea5e9", "#14b8a6", "#64748b"];

const MemberSessionReplay = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [spinResults, setSpinResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replayIndex, setReplayIndex] = useState(-1);
  const [isReplaying, setIsReplaying] = useState(false);
  const [currentWinner, setCurrentWinner] = useState(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const [currentMembers, setCurrentMembers] = useState([]);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  const memberToken = localStorage.getItem("memberAccessToken");
  const memberInfo = JSON.parse(localStorage.getItem("memberInfo") || "{}");

  const apiClient = axios.create({
    baseURL: BACKEND_URL,
    headers: {
      "Authorization": `Bearer ${memberToken}`
    }
  });

  // Fetch session data
  useEffect(() => {
    if (!memberToken) {
      toast.error("Please login to view replay");
      navigate("/");
      return;
    }

    const fetchSession = async () => {
      try {
        const [sessionRes, spinsRes] = await Promise.all([
          apiClient.get(`/api/member-portal/session/${sessionId}`),
          apiClient.get(`/api/member-portal/session/${sessionId}/spins`)
        ]);
        setSession(sessionRes.data);
        setSpinResults(spinsRes.data);
        
        // Set initial members from first spin
        if (spinsRes.data.length > 0 && spinsRes.data[0].members_at_spin) {
          setCurrentMembers(spinsRes.data[0].members_at_spin);
        }
      } catch (error) {
        console.error("Failed to load session", error);
        if (error.response?.status === 401) {
          toast.error("Session expired. Please login again.");
          navigate("/");
        } else {
          toast.error("Failed to load session replay");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId, memberToken, navigate]);

  // Draw the wheel - matching admin version exactly
  const drawWheel = useCallback((members, rotation, highlightIndex = -1) => {
    const canvas = canvasRef.current;
    if (!canvas || members.length === 0) return;

    const ctx = canvas.getContext("2d");
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sliceAngle = (2 * Math.PI) / members.length;
    const colors = DEFAULT_WHEEL_COLORS;

    members.forEach((member, index) => {
      const startAngle = index * sliceAngle + (rotation * Math.PI) / 180;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = colors[index % colors.length];
      ctx.fill();

      ctx.strokeStyle = highlightIndex === index ? "#fbbf24" : "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = highlightIndex === index ? 4 : 2;
      ctx.stroke();

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

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SPIN", centerX, centerY);
  }, []);

  // Initial wheel draw - only when not spinning
  useEffect(() => {
    if (currentMembers.length > 0 && !isWheelSpinning) {
      drawWheel(currentMembers, wheelRotation);
    }
  }, [currentMembers, drawWheel, isWheelSpinning, wheelRotation]);

  // Animate wheel to a specific spin result - matching admin version exactly
  const animateToSpin = useCallback((spinIndex) => {
    if (spinIndex < 0 || spinIndex >= spinResults.length) return;

    const spin = spinResults[spinIndex];
    const members = spin.members_at_spin || [];
    
    if (members.length === 0) {
      // Auto-selected (last member) - just show the result
      setCurrentWinner(spin);
      setIsWheelSpinning(false);
      return;
    }

    // Update current members to what was on the wheel
    setCurrentMembers(members);
    
    if (spin.is_auto_selected) {
      // Don't animate for auto-selected, just show
      setCurrentWinner(spin);
      drawWheel(members, 0, 0);
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: DEFAULT_WHEEL_COLORS
      });
      return;
    }

    setIsWheelSpinning(true);
    setCurrentWinner(null);

    const targetAngle = spin.spin_angle;
    const startRotation = 0; // Always start from 0 for consistent replay
    const duration = 4000;
    const startTime = Date.now();

    // Calculate total rotation to end exactly at targetAngle
    const extraRotations = 3 * 360;
    const normalizedTarget = ((targetAngle % 360) + 360) % 360;
    const totalRotation = extraRotations + normalizedTarget;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentRotation = totalRotation * easeOut;
      setWheelRotation(currentRotation);
      drawWheel(members, currentRotation);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Ensure we end exactly at the target angle
        setWheelRotation(normalizedTarget);
        drawWheel(members, normalizedTarget);
        setIsWheelSpinning(false);
        setCurrentWinner(spin);
        
        const winnerIndex = members.findIndex(m => m.id === spin.winner_member_id);
        drawWheel(members, normalizedTarget, winnerIndex);
        
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: DEFAULT_WHEEL_COLORS
        });
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [spinResults, wheelRotation, drawWheel]);

  // Handle replay sequence - only trigger when isReplaying is true
  useEffect(() => {
    if (isReplaying && !isWheelSpinning && replayIndex < spinResults.length) {
      if (replayIndex === -1) {
        const timer = setTimeout(() => {
          setReplayIndex(0);
        }, 500);
        return () => clearTimeout(timer);
      } else {
        animateToSpin(replayIndex);
      }
    }
  }, [isReplaying, replayIndex, isWheelSpinning, spinResults.length, animateToSpin]);

  // Move to next spin after current animation completes - only when in replay mode
  useEffect(() => {
    if (isReplaying && !isWheelSpinning && currentWinner && replayIndex >= 0) {
      if (replayIndex < spinResults.length - 1) {
        const timer = setTimeout(() => {
          setReplayIndex(prev => prev + 1);
          setCurrentWinner(null);
        }, 2000);
        return () => clearTimeout(timer);
      } else {
        setIsReplaying(false);
      }
    }
  }, [isReplaying, isWheelSpinning, currentWinner, replayIndex, spinResults.length]);

  const startReplay = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    setWheelRotation(0);
    setReplayIndex(-1);
    setCurrentWinner(null);
    setIsReplaying(true);
    
    // Reset to first spin's members and draw at rotation 0
    if (spinResults.length > 0 && spinResults[0].members_at_spin) {
      setCurrentMembers(spinResults[0].members_at_spin);
      drawWheel(spinResults[0].members_at_spin, 0);
    }
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
    if (spinResults.length > 0 && spinResults[0].members_at_spin) {
      setCurrentMembers(spinResults[0].members_at_spin);
      drawWheel(spinResults[0].members_at_spin, 0);
    }
  };

  // Skip to a specific spin - does NOT start auto-replay mode
  const skipToSpin = (index) => {
    console.log("skipToSpin called with index:", index);
    
    // Stop any ongoing replay/animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsReplaying(false);  // Important: disable auto-replay mode
    setIsWheelSpinning(false);
    setCurrentWinner(null);
    setWheelRotation(0);
    
    // Get the spin data
    const spin = spinResults[index];
    if (!spin || !spin.members_at_spin) {
      console.log("No spin data at index:", index);
      return;
    }
    
    console.log("Setting replayIndex to:", index);
    // Update members first
    setCurrentMembers(spin.members_at_spin);
    setReplayIndex(index);
    
    // Animate after a brief delay to let state update
    setTimeout(() => {
      console.log("Timeout callback, animating index:", index);
      // Re-fetch the spin to avoid stale closure
      const targetSpin = spinResults[index];
      if (!targetSpin) {
        console.log("targetSpin not found at index:", index);
        return;
      }
      
      const members = targetSpin.members_at_spin || [];
      if (members.length === 0) {
        setCurrentWinner(targetSpin);
        return;
      }

      if (targetSpin.is_auto_selected) {
        setCurrentWinner(targetSpin);
        drawWheel(members, 0, 0);
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: DEFAULT_WHEEL_COLORS
        });
        return;
      }

      setIsWheelSpinning(true);
      
      const targetAngle = targetSpin.spin_angle;
      const extraRotations = 3 * 360;
      const normalizedTarget = ((targetAngle % 360) + 360) % 360;
      const totalRotation = extraRotations + normalizedTarget;
      const duration = 4000;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentRotation = totalRotation * easeOut;
        
        setWheelRotation(currentRotation);
        drawWheel(members, currentRotation);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          console.log("Animation complete for index:", index);
          setWheelRotation(normalizedTarget);
          drawWheel(members, normalizedTarget);
          setIsWheelSpinning(false);
          setCurrentWinner(targetSpin);
          
          const winnerIndex = members.findIndex(m => m.id === targetSpin.winner_member_id);
          drawWheel(members, normalizedTarget, winnerIndex);
          
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 },
            colors: DEFAULT_WHEEL_COLORS
          });
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    }, 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Card className="bg-slate-800/50 border-slate-700/50 p-8 text-center">
          <p className="text-white mb-4">Session not found</p>
          <Link to={`/member-portal/${memberInfo.group_id}`}>
            <Button>Back to Portal</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const totalMembers = spinResults.length > 0 && spinResults[0].members_at_spin 
    ? spinResults[0].members_at_spin.length 
    : 0;
  const progress = totalMembers > 0 ? (spinResults.length / totalMembers) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/member-portal/${memberInfo.group_id}`}>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-bold text-white">{session.group_name}</h1>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(session.started_at), "MMM d, yyyy")}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(session.started_at), "h:mm a")}
                </span>
              </div>
            </div>
          </div>
          <Badge className={session.status === "completed" ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"}>
            {session.status === "completed" ? "Completed" : "In Progress"}
          </Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Progress bar */}
        <Card className="bg-slate-800/50 border-slate-700/50 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">Cycle Progress</span>
              <span className="text-sm text-slate-400">
                {spinResults.length} of {totalMembers} selections
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Wheel Replay Section */}
          <div className="lg:col-span-8">
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-white">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-500" />
                    Cycle Replay
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetReplay}
                      disabled={isWheelSpinning}
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={isReplaying ? pauseReplay : startReplay}
                      disabled={spinResults.length === 0 || isWheelSpinning}
                      className="bg-blue-600 hover:bg-blue-700"
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
                    <p className="text-slate-400">No spins recorded in this session</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    {/* Arrow pointer at the TOP - matching admin version */}
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
                      />
                    </div>

                    {/* Current winner announcement */}
                    {currentWinner && (
                      <div className="mt-6 bg-slate-700/50 border border-slate-600/50 rounded-2xl p-6 text-center animate-pulse">
                        <p className="text-sm text-slate-400 mb-1 uppercase tracking-wider flex items-center justify-center gap-2">
                          {currentWinner.is_auto_selected ? (
                            <><Sparkles className="w-4 h-4" /> Auto-Selected (Last Member)</>
                          ) : (
                            <>Spin #{currentWinner.spin_number} Winner</>
                          )}
                        </p>
                        <h2 className="text-2xl font-bold text-blue-400">
                          {currentWinner.winner_name}
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                          {format(new Date(currentWinner.created_at), "h:mm:ss a")}
                        </p>
                      </div>
                    )}

                    {/* Progress indicator */}
                    <div className="mt-4 text-sm text-slate-400">
                      {replayIndex >= 0 ? (
                        <span>Selection {Math.min(replayIndex + 1, spinResults.length)} of {spinResults.length}</span>
                      ) : (
                        <span>Ready to replay {spinResults.length} selections</span>
                      )}
                    </div>

                    {/* Current members on wheel */}
                    {currentMembers.length > 0 && (
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        {currentMembers.map((member) => (
                          <Badge key={member.id} variant="outline" className="text-xs border-slate-600 text-slate-300">
                            {member.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Results Timeline */}
          <div className="lg:col-span-4">
            <Card className="bg-slate-800/50 border-slate-700/50 h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Selection Order ({spinResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {spinResults.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-400">No spins recorded</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[450px] pr-4">
                    <div className="space-y-3">
                      {spinResults.map((result, index) => (
                        <button
                          key={result.id}
                          onClick={() => skipToSpin(index)}
                          disabled={isWheelSpinning}
                          className={`w-full text-left relative flex flex-col gap-2 p-4 rounded-xl border transition-all duration-300 hover:border-blue-500/50 ${
                            replayIndex === index 
                              ? "border-blue-500/50 bg-blue-500/10" 
                              : replayIndex > index
                              ? "border-emerald-500/30 bg-emerald-500/5"
                              : "border-slate-700/50 bg-slate-800/50"
                          } ${isWheelSpinning ? "pointer-events-none opacity-50" : ""}`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Spin number badge */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                              replayIndex === index 
                                ? "bg-amber-500 text-white" 
                                : replayIndex > index
                                ? "bg-emerald-500 text-white"
                                : "bg-slate-700 text-slate-400"
                            }`}>
                              {result.spin_number}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium truncate ${
                                replayIndex === index ? "text-white" : "text-slate-300"
                              }`}>
                                {result.winner_name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {format(new Date(result.created_at), "h:mm:ss a")}
                              </p>
                            </div>

                            {/* Status indicators */}
                            <div className="flex items-center gap-1">
                              {result.is_auto_selected && (
                                <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                                  Auto
                                </Badge>
                              )}
                              {replayIndex === index && (
                                <Badge className="bg-amber-500/20 text-amber-400 text-xs">
                                  Current
                                </Badge>
                              )}
                              {replayIndex > index && (
                                <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">
                                  Done
                                </Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MemberSessionReplay;
