import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { 
  Loader2, 
  Send, 
  Users, 
  Trophy, 
  MessageCircle, 
  Clock,
  LogOut,
  RefreshCw,
  Circle,
  Play,
  Bell,
  Sparkles,
  ArrowRight,
  X
} from "lucide-react";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const DEFAULT_WHEEL_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#0ea5e9", "#14b8a6", "#64748b"];

// Format date in CST timezone
const formatCST = (dateString, formatStr) => {
  try {
    return formatInTimeZone(new Date(dateString), 'America/Chicago', formatStr);
  } catch (e) {
    return format(new Date(dateString), formatStr);
  }
};

const MemberPortal = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [groupData, setGroupData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [onlineMembers, setOnlineMembers] = useState([]);
  const [lastSpinCount, setLastSpinCount] = useState(0);
  const [newSpinAlert, setNewSpinAlert] = useState(false);
  const [remainingMembers, setRemainingMembers] = useState([]);
  const chatEndRef = useRef(null);
  const liveWheelRef = useRef(null);
  
  // Replay modal state
  const [replayingSpin, setReplayingSpin] = useState(null);
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const [showWinner, setShowWinner] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [canClose, setCanClose] = useState(true);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const countdownRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const memberToken = localStorage.getItem("memberAccessToken");
  const memberInfo = JSON.parse(localStorage.getItem("memberInfo") || "{}");

  const apiClient = axios.create({
    baseURL: BACKEND_URL,
    headers: {
      "Authorization": `Bearer ${memberToken}`
    }
  });

  // Draw wheel function for replay modal
  const drawWheel = useCallback((canvas, members, rotation, highlightWinnerId = null) => {
    if (!canvas || members.length === 0) return;

    const ctx = canvas.getContext("2d");
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 15;

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
  }, []);

  // Start countdown for auto-close
  const startCountdown = useCallback(() => {
    setCountdown(10);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          setCanClose(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Play replay for a specific spin
  const playReplay = useCallback((spin) => {
    setReplayingSpin(spin);
    setShowWinner(false);
    setIsWheelSpinning(true);
    setCanClose(false);
    setCountdown(0);

    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas || !spin.members_at_spin || spin.members_at_spin.length === 0) {
        setIsWheelSpinning(false);
        setShowWinner(true);
        startCountdown();
        return;
      }

      const members = spin.members_at_spin;
      const targetAngle = spin.spin_angle || 0;
      
      if (spin.is_auto_selected) {
        drawWheel(canvas, members, 0, spin.winner_member_id);
        setIsWheelSpinning(false);
        setShowWinner(true);
        startCountdown();
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
            colors: DEFAULT_WHEEL_COLORS
          });

          startCountdown();
        }
      };

      drawWheel(canvas, members, 0);
      animationRef.current = requestAnimationFrame(animate);
    }, 100);
  }, [drawWheel, startCountdown]);

  // Close replay modal
  const closeReplay = useCallback(() => {
    if (!canClose) return;
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    setReplayingSpin(null);
    setIsWheelSpinning(false);
    setShowWinner(false);
    setCountdown(0);
    setCanClose(true);
  }, [canClose]);

  const fetchGroupData = useCallback(async (showAlert = false) => {
    try {
      const res = await apiClient.get("/api/member-portal/group");
      const newData = res.data;
      
      // Check if there are new spins
      const newSpinCount = newData.recent_spins?.length || 0;
      if (showAlert && newSpinCount > lastSpinCount && lastSpinCount > 0) {
        const latestWinner = newData.recent_spins[0]?.winner_name;
        toast.success(`🎉 New winner: ${latestWinner}!`, {
          duration: 5000,
        });
        setNewSpinAlert(true);
        setTimeout(() => setNewSpinAlert(false), 3000);
      }
      setLastSpinCount(newSpinCount);
      
      setGroupData(newData);
      setOnlineMembers(newData.members || []);
      setRemainingMembers(newData.remaining_members || []);
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error("Session expired. Please login again.");
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  }, [lastSpinCount]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await apiClient.get("/api/member-portal/chat");
      setMessages(res.data);
    } catch (error) {
      console.error("Failed to fetch messages");
    }
  }, []);

  const sendHeartbeat = useCallback(async () => {
    try {
      const res = await apiClient.post("/api/member-portal/heartbeat");
      setOnlineMembers(res.data.online_members || []);
    } catch (error) {
      console.error("Heartbeat failed");
    }
  }, []);

  useEffect(() => {
    if (!memberToken) {
      navigate("/");
      return;
    }

    // Verify the group matches
    if (memberInfo.group_id && memberInfo.group_id !== groupId) {
      toast.error("Invalid group access");
      navigate("/");
      return;
    }

    fetchGroupData(false);
    fetchMessages();

    // Start polling for updates - every 3 seconds for real-time feel
    pollIntervalRef.current = setInterval(() => {
      sendHeartbeat();
      fetchMessages();
      fetchGroupData(true); // Check for new spins
    }, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [memberToken, groupId, navigate]);

  useEffect(() => {
    // Scroll to bottom when messages change
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const res = await apiClient.post("/api/member-portal/chat", {
        content: newMessage.trim()
      });
      setMessages(prev => [...prev, res.data]);
      setNewMessage("");
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("memberAccessToken");
    localStorage.removeItem("memberInfo");
    navigate("/");
  };

  const handleManualRefresh = () => {
    fetchGroupData(false);
    fetchMessages();
    toast.success("Refreshed!");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const currentMember = groupData?.current_member;
  const group = groupData?.group;
  const recentSpins = groupData?.recent_spins || [];
  const session = groupData?.session;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <span className="text-lg font-bold text-white">R</span>
            </div>
            <div>
              <h1 className="font-bold text-white">{group?.name}</h1>
              <p className="text-xs text-slate-400">Welcome, {currentMember?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {newSpinAlert && (
              <Badge className="bg-green-500 text-white animate-pulse">
                <Bell className="w-3 h-3 mr-1" /> New Spin!
              </Badge>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleManualRefresh}
              className="text-slate-400 hover:text-white"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Spins & Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Session Status */}
            <Card className={`bg-slate-800/50 border-slate-700/50 ${newSpinAlert ? 'ring-2 ring-green-500 ring-opacity-50' : ''}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  {session ? "Active Spin Cycle" : "No Active Cycle"}
                  {session && (
                    <Badge className="ml-2 bg-green-500/20 text-green-400 border-green-500/30">
                      Live
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {session ? (
                  <div className="flex items-center gap-4">
                    <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                      In Progress
                    </Badge>
                    <span className="text-sm text-slate-400">
                      Started {format(new Date(session.started_at), "MMM d, yyyy h:mm a")}
                    </span>
                  </div>
                ) : (
                  <p className="text-slate-400">
                    Waiting for the moderator to start a new spin cycle.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Spin History Table */}
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Spin History
                </CardTitle>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Auto-refreshing
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {recentSpins.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">
                    No spins recorded yet.
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-700 bg-slate-900/50">
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-400 w-16">#</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Winner</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Members on Wheel</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Previously Selected</th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-slate-400 w-44">Date & Time (CST)</th>
                            <th className="text-center py-3 px-4 text-sm font-medium text-slate-400 w-24">Replay</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...recentSpins].reverse().map((spin, index, arr) => {
                            const isLatest = index === arr.length - 1;
                            const previousWinners = arr
                              .filter((s, i) => i < index)
                              .map(s => s.winner_name);
                            const membersOnWheel = spin.members_at_spin || [];
                            
                            return (
                              <tr 
                                key={spin.id} 
                                className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${
                                  isLatest && newSpinAlert ? 'bg-yellow-500/10 animate-pulse' : ''
                                }`}
                              >
                                {/* Spin Number */}
                                <td className="py-3 px-4">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                    spin.is_auto_selected 
                                      ? "bg-violet-500/20 text-violet-400"
                                      : isLatest 
                                        ? "bg-yellow-500/20 text-yellow-400"
                                        : "bg-blue-500/20 text-blue-400"
                                  }`}>
                                    {spin.spin_number}
                                  </div>
                                </td>
                                
                                {/* Winner */}
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <Trophy className={`w-4 h-4 ${isLatest ? "text-yellow-400" : "text-blue-400"}`} />
                                    <span className={`font-medium ${isLatest ? "text-yellow-400" : "text-white"}`}>
                                      {spin.winner_name}
                                    </span>
                                    {spin.is_auto_selected && (
                                      <Badge className="text-xs bg-violet-500/20 text-violet-400 border-violet-500/30">
                                        <Sparkles className="w-3 h-3 mr-1" />
                                        Auto
                                      </Badge>
                                    )}
                                    {isLatest && (
                                      <Badge className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                                        Latest
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
                                          variant="outline"
                                          className={`text-xs ${
                                            member.id === spin.winner_member_id 
                                              ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                              : "bg-slate-700/50 text-slate-300 border-slate-600"
                                          }`}
                                        >
                                          {member.name}
                                        </Badge>
                                      ))
                                    ) : (
                                      <span className="text-sm text-slate-500">-</span>
                                    )}
                                  </div>
                                </td>
                                
                                {/* Previously Selected */}
                                <td className="py-3 px-4">
                                  {previousWinners.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {previousWinners.map((name, idx) => (
                                        <Badge key={idx} className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                          {name}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-slate-500">First spin</span>
                                  )}
                                </td>
                                
                                {/* Date & Time in CST */}
                                <td className="py-3 px-4 text-sm text-slate-400">
                                  <div>
                                    {formatCST(spin.created_at, "MMM d, yyyy")}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {formatCST(spin.created_at, "h:mm:ss a")} CST
                                  </div>
                                </td>

                                {/* Replay Button */}
                                <td className="py-3 px-4 text-center">
                                  {spin.members_at_spin && spin.members_at_spin.length > 0 && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => playReplay(spin)}
                                      className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                    >
                                      <Play className="w-4 h-4" />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Selection Order Footer */}
                    <div className="px-4 py-3 bg-slate-900/30 border-t border-slate-700/50">
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="text-slate-500">Selection order:</span>
                        {[...recentSpins].reverse().map((spin, idx, arr) => (
                          <span key={spin.id} className="flex items-center">
                            <span className={`font-medium ${spin.is_auto_selected ? "text-violet-400" : "text-white"}`}>
                              {spin.winner_name}
                            </span>
                            {idx < arr.length - 1 && (
                              <ArrowRight className="w-3 h-3 mx-1 text-slate-600" />
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Group Info */}
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-lg bg-slate-700/30">
                    <p className="text-2xl font-bold text-white">
                      {group?.currency} {group?.contribution_amount?.toFixed(2)}
                    </p>
                    <p className="text-sm text-slate-400">Contribution</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-slate-700/30">
                    <p className="text-2xl font-bold text-white">
                      {onlineMembers.length}
                    </p>
                    <p className="text-sm text-slate-400">Total Members</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Chat & Online Members */}
          <div className="space-y-6">
            {/* Online Members */}
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <Users className="w-5 h-5 text-green-400" />
                  Members
                  <Badge variant="outline" className="ml-2 text-xs">
                    {onlineMembers.filter(m => m.is_online).length} online
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {onlineMembers.map((member) => (
                    <div 
                      key={member.member_id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/30"
                    >
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-medium">
                          {member.member_name.charAt(0).toUpperCase()}
                        </div>
                        <Circle 
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${
                            member.is_online 
                              ? "text-green-500 fill-green-500" 
                              : "text-slate-500 fill-slate-500"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${
                          member.member_id === currentMember?.id ? "text-blue-400" : "text-white"
                        }`}>
                          {member.member_name}
                          {member.member_id === currentMember?.id && " (You)"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {member.is_online ? "Online now" : "Offline"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Chat */}
            <Card className="bg-slate-800/50 border-slate-700/50 flex flex-col" style={{ height: "400px" }}>
              <CardHeader className="pb-3 flex-shrink-0">
                <CardTitle className="text-lg flex items-center gap-2 text-white">
                  <MessageCircle className="w-5 h-5 text-blue-400" />
                  Group Chat
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
                <ScrollArea className="flex-1 px-4">
                  <div className="space-y-3 py-2">
                    {messages.length === 0 ? (
                      <p className="text-center text-slate-500 text-sm py-4">
                        No messages yet. Start the conversation!
                      </p>
                    ) : (
                      messages.map((msg) => {
                        const isOwnMessage = msg.member_id === currentMember?.id;
                        return (
                          <div 
                            key={msg.id}
                            className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                          >
                            <div className={`max-w-[80%] ${
                              isOwnMessage 
                                ? "bg-blue-600 text-white" 
                                : "bg-slate-700 text-white"
                            } rounded-lg px-3 py-2`}>
                              {!isOwnMessage && (
                                <p className="text-xs font-medium text-blue-300 mb-1">
                                  {msg.member_name}
                                </p>
                              )}
                              <p className="text-sm break-words">{msg.content}</p>
                              <p className={`text-xs mt-1 ${
                                isOwnMessage ? "text-blue-200" : "text-slate-400"
                              }`}>
                                {format(new Date(msg.created_at), "h:mm a")}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>
                
                {/* Message Input */}
                <form 
                  onSubmit={handleSendMessage}
                  className="flex-shrink-0 p-4 border-t border-slate-700/50"
                >
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                      maxLength={500}
                      data-testid="chat-input"
                    />
                    <Button 
                      type="submit" 
                      size="icon"
                      disabled={sending || !newMessage.trim()}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="chat-send-btn"
                    >
                      {sending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Replay Modal */}
      <Dialog open={!!replayingSpin} onOpenChange={() => canClose && closeReplay()}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Spin #{replayingSpin?.spin_number} Replay
              </span>
              {countdown > 0 && (
                <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                  Closes in {countdown}s
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center py-4">
            {/* Arrow pointer - matching admin */}
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

            {/* Wheel */}
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={280}
                height={280}
                className="rounded-full"
              />
              
              {isWheelSpinning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-sm text-slate-400 animate-pulse">
                    Spinning...
                  </div>
                </div>
              )}
            </div>

            {/* Winner Display */}
            {showWinner && replayingSpin && (
              <div className="mt-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-2 flex items-center justify-center gap-2">
                  <Trophy className="w-6 h-6 text-yellow-500" />
                  <span className="text-sm text-slate-400 uppercase tracking-wider">Winner</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {replayingSpin.winner_name}
                </p>
                {replayingSpin.is_auto_selected && (
                  <Badge className="mt-2 bg-violet-500/20 text-violet-400 border-violet-500/30">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Auto-Selected (Last Member)
                  </Badge>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  {formatCST(replayingSpin.created_at, "MMM d, yyyy 'at' h:mm:ss a")} CST
                </p>
              </div>
            )}

            {/* Members on Wheel */}
            {replayingSpin?.members_at_spin && replayingSpin.members_at_spin.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-1">
                {replayingSpin.members_at_spin.map((member) => (
                  <Badge 
                    key={member.id} 
                    variant="outline"
                    className={`text-xs ${
                      member.id === replayingSpin.winner_member_id && showWinner
                        ? "bg-green-500/20 text-green-400 border-green-500/30"
                        : "border-slate-600 text-slate-400"
                    }`}
                  >
                    {member.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Close Button */}
          {canClose && (
            <div className="flex justify-center">
              <Button 
                onClick={closeReplay}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                <X className="w-4 h-4 mr-2" />
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MemberPortal;
