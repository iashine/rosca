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

  // Draw the wheel - matching admin version
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

  // Initial wheel draw
  useEffect(() => {
    if (currentMembers.length > 0) {
      drawWheel(currentMembers, 0);
    }
  }, [currentMembers, drawWheel]);

  // Animate wheel to a specific spin result - matching admin version
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
    const startRotation = wheelRotation;
    const duration = 4000;
    const startTime = Date.now();

    const extraRotations = 3 * 360;
    const totalRotation = startRotation + extraRotations + (targetAngle - (startRotation % 360) + 360) % 360;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentRotation = startRotation + (totalRotation - startRotation) * easeOut;
      setWheelRotation(currentRotation);
      drawWheel(members, currentRotation);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsWheelSpinning(false);
        setCurrentWinner(spin);
        
        const winnerIndex = members.findIndex(m => m.id === spin.winner_member_id);
        drawWheel(members, currentRotation, winnerIndex);
        
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

  // Handle replay sequence
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
    
    // Reset to first spin's members
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

  const skipToSpin = (index) => {
    pauseReplay();
    setReplayIndex(index);
    animateToSpin(index);
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Wheel */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                  Spin Replay
                  {isWheelSpinning && (
                    <Badge className="bg-blue-500/20 text-blue-400 ml-2">Spinning...</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                {/* Wheel Canvas */}
                <div className="relative mb-6">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={400}
                    className="rounded-full shadow-2xl"
                  />
                  
                  {/* Pointer */}
                  <div className="absolute top-1/2 -right-2 transform -translate-y-1/2">
                    <div className="w-0 h-0 border-t-[15px] border-t-transparent border-b-[15px] border-b-transparent border-r-[25px] border-r-red-500" />
                  </div>

                  {/* Winner overlay */}
                  {currentWinner && !isWheelSpinning && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-slate-900/95 rounded-xl p-6 text-center shadow-2xl border border-yellow-500/30 animate-bounce">
                        <Trophy className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
                        <p className="text-xl font-bold text-white">{currentWinner.winner_name}</p>
                        <p className="text-sm text-slate-400 mt-1">Spin #{currentWinner.spin_number}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="flex gap-3 mb-4">
                  {!isReplaying ? (
                    <Button
                      onClick={startReplay}
                      disabled={spinResults.length === 0 || isWheelSpinning}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      {replayIndex >= 0 ? "Resume" : "Start Replay"}
                    </Button>
                  ) : (
                    <Button onClick={pauseReplay} variant="secondary">
                      <Pause className="w-4 h-4 mr-2" />
                      Pause
                    </Button>
                  )}
                  <Button 
                    onClick={resetReplay} 
                    variant="outline" 
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    disabled={isWheelSpinning}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                </div>

                {/* Replay Progress */}
                {spinResults.length > 0 && (
                  <div className="w-full max-w-md">
                    <div className="flex justify-between text-sm text-slate-400 mb-2">
                      <span>Replay Progress</span>
                      <span>{Math.max(0, replayIndex + 1)} / {spinResults.length} spins</span>
                    </div>
                    <Progress 
                      value={(Math.max(0, replayIndex + 1) / spinResults.length) * 100} 
                      className="h-2" 
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Spin History */}
          <div>
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Spin Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[450px]">
                  <div className="space-y-2">
                    {spinResults.length === 0 ? (
                      <p className="text-center text-slate-400 py-4">No spins recorded</p>
                    ) : (
                      spinResults.map((spin, index) => (
                        <div
                          key={spin.id}
                          onClick={() => !isWheelSpinning && skipToSpin(index)}
                          className={`p-3 rounded-lg cursor-pointer transition-all ${
                            replayIndex === index
                              ? "bg-blue-500/20 border border-blue-500/50 ring-2 ring-blue-500/30"
                              : currentWinner?.id === spin.id
                              ? "bg-yellow-500/20 border border-yellow-500/50"
                              : "bg-slate-700/30 hover:bg-slate-700/50 border border-transparent"
                          } ${isWheelSpinning ? "pointer-events-none opacity-50" : ""}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                replayIndex === index 
                                  ? "bg-blue-500 text-white" 
                                  : currentWinner?.id === spin.id
                                  ? "bg-yellow-500 text-black"
                                  : "bg-slate-600 text-white"
                              }`}>
                                {spin.spin_number}
                              </div>
                              <div>
                                <p className={`font-medium ${
                                  currentWinner?.id === spin.id ? "text-yellow-400" : "text-white"
                                }`}>
                                  {spin.winner_name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {format(new Date(spin.created_at), "h:mm:ss a")}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {spin.is_auto_selected && (
                                <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                                  Auto
                                </Badge>
                              )}
                              {replayIndex === index && isWheelSpinning && (
                                <Badge className="bg-blue-500/20 text-blue-400 text-xs">
                                  Playing
                                </Badge>
                              )}
                              {currentWinner?.id === spin.id && !isWheelSpinning && (
                                <Trophy className="w-4 h-4 text-yellow-500" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MemberSessionReplay;
