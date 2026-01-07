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
  FastForward,
  Users,
  Sparkles,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Default wheel colors
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

  // Draw the wheel with given members
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
      ctx.font = "bold 14px sans-serif";
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 4;
      const name = member.name.length > 12 ? member.name.substring(0, 12) + "..." : member.name;
      ctx.fillText(name, radius - 15, 5);
      ctx.restore();
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
    ctx.fillStyle = "#1e293b";
    ctx.fill();
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw pointer
    ctx.beginPath();
    ctx.moveTo(centerX + radius + 5, centerY);
    ctx.lineTo(centerX + radius - 20, centerY - 15);
    ctx.lineTo(centerX + radius - 20, centerY + 15);
    ctx.closePath();
    ctx.fillStyle = "#ef4444";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, []);

  // Draw wheel when members change
  useEffect(() => {
    if (currentMembers.length > 0) {
      drawWheel(currentMembers, wheelRotation);
    }
  }, [currentMembers, wheelRotation, drawWheel]);

  // Animate wheel spin
  const animateWheelSpin = useCallback((targetAngle, duration = 4000) => {
    return new Promise((resolve) => {
      setIsWheelSpinning(true);
      const startTime = Date.now();
      const startRotation = wheelRotation;
      const totalRotation = 360 * 5 + targetAngle;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentRotation = startRotation + totalRotation * easeOut;
        
        setWheelRotation(currentRotation % 360);
        drawWheel(currentMembers, currentRotation % 360);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setIsWheelSpinning(false);
          resolve();
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    });
  }, [wheelRotation, currentMembers, drawWheel]);

  // Fire confetti
  const fireConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  // Replay a single spin
  const replaySpin = useCallback(async (spinIndex) => {
    const spin = spinResults[spinIndex];
    if (!spin) return;

    // Set the members for this spin
    if (spin.members_at_spin) {
      setCurrentMembers(spin.members_at_spin);
    }

    // Small delay to update the wheel
    await new Promise(r => setTimeout(r, 100));

    // Animate the spin
    await animateWheelSpin(spin.spin_angle);

    // Show winner
    setCurrentWinner(spin);
    fireConfetti();

    // Wait before continuing
    await new Promise(r => setTimeout(r, 2000));

    // Remove winner from members for next spin visualization
    if (spin.members_at_spin) {
      const remainingMembers = spin.members_at_spin.filter(m => m.id !== spin.winner_member_id);
      setCurrentMembers(remainingMembers);
    }
  }, [spinResults, animateWheelSpin]);

  // Start replay
  const startReplay = async () => {
    if (spinResults.length === 0) return;

    setIsReplaying(true);
    setCurrentWinner(null);
    
    // Reset to first spin's members
    if (spinResults[0]?.members_at_spin) {
      setCurrentMembers(spinResults[0].members_at_spin);
    }

    for (let i = 0; i < spinResults.length; i++) {
      setReplayIndex(i);
      await replaySpin(i);
    }

    setIsReplaying(false);
    setReplayIndex(-1);
  };

  // Stop replay
  const stopReplay = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsReplaying(false);
    setIsWheelSpinning(false);
  };

  // Reset replay
  const resetReplay = () => {
    stopReplay();
    setReplayIndex(-1);
    setCurrentWinner(null);
    setWheelRotation(0);
    if (spinResults[0]?.members_at_spin) {
      setCurrentMembers(spinResults[0].members_at_spin);
    }
  };

  // Skip to spin
  const skipToSpin = async (index) => {
    stopReplay();
    setReplayIndex(index);
    
    // Set members for that spin
    if (spinResults[index]?.members_at_spin) {
      setCurrentMembers(spinResults[index].members_at_spin);
    }
    
    setCurrentWinner(spinResults[index]);
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
              <p className="text-xs text-slate-400">Session Replay</p>
            </div>
          </div>
          <Badge className={session.status === "completed" ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"}>
            {session.status === "completed" ? "Completed" : "In Progress"}
          </Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Wheel */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                  Spin Replay
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
                  {currentWinner && !isWheelSpinning && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-slate-900/90 rounded-lg p-4 text-center animate-bounce">
                        <Trophy className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                        <p className="text-white font-bold">{currentWinner.winner_name}</p>
                        <p className="text-sm text-slate-400">Spin #{currentWinner.spin_number}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="flex gap-3 mb-4">
                  {!isReplaying ? (
                    <Button
                      onClick={startReplay}
                      disabled={spinResults.length === 0}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Replay
                    </Button>
                  ) : (
                    <Button onClick={stopReplay} variant="destructive">
                      <Pause className="w-4 h-4 mr-2" />
                      Stop
                    </Button>
                  )}
                  <Button onClick={resetReplay} variant="outline" className="border-slate-600 text-slate-300">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                </div>

                {/* Progress */}
                {spinResults.length > 0 && (
                  <div className="w-full max-w-md">
                    <div className="flex justify-between text-sm text-slate-400 mb-2">
                      <span>Progress</span>
                      <span>{Math.max(0, replayIndex + 1)} / {spinResults.length} spins</span>
                    </div>
                    <Progress value={(Math.max(0, replayIndex + 1) / spinResults.length) * 100} className="h-2" />
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
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {spinResults.length === 0 ? (
                      <p className="text-center text-slate-400 py-4">No spins recorded</p>
                    ) : (
                      spinResults.map((spin, index) => (
                        <div
                          key={spin.id}
                          onClick={() => !isReplaying && skipToSpin(index)}
                          className={`p-3 rounded-lg cursor-pointer transition-all ${
                            replayIndex === index
                              ? "bg-blue-500/20 border border-blue-500/50"
                              : "bg-slate-700/30 hover:bg-slate-700/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                replayIndex === index ? "bg-blue-500" : "bg-slate-600"
                              }`}>
                                {spin.spin_number}
                              </div>
                              <div>
                                <p className="font-medium text-white">{spin.winner_name}</p>
                                <p className="text-xs text-slate-400">
                                  {format(new Date(spin.created_at), "MMM d, h:mm a")}
                                </p>
                              </div>
                            </div>
                            {replayIndex === index && (
                              <Badge className="bg-blue-500/20 text-blue-400">Current</Badge>
                            )}
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
