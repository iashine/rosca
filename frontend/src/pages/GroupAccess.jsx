import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Loader2, Lock, Users, ArrowRight } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const GroupAccess = () => {
  const { accessCode } = useParams();
  const navigate = useNavigate();
  const [groupInfo, setGroupInfo] = useState(null);
  const [passcode, setPasscode] = useState("");
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    const fetchGroupInfo = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/group-access/${accessCode}/info`);
        setGroupInfo(res.data);
      } catch (error) {
        toast.error("Invalid or expired access link");
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    fetchGroupInfo();
  }, [accessCode, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!passcode.trim()) {
      toast.error("Please enter your passcode");
      return;
    }

    setLoggingIn(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/group-access/${accessCode}/login`, {
        passcode: passcode.trim()
      });
      
      // Store member access token
      localStorage.setItem("memberAccessToken", res.data.access_token);
      localStorage.setItem("memberInfo", JSON.stringify({
        member_id: res.data.member_id,
        member_name: res.data.member_name,
        group_id: res.data.group_id,
        group_name: res.data.group_name
      }));
      
      toast.success(`Welcome to ${res.data.group_name}!`);
      navigate(`/member-portal/${res.data.group_id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Invalid passcode");
    } finally {
      setLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <span className="text-2xl font-bold text-white">R</span>
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">ROSCA Spin</span>
          </div>
        </div>

        <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Users className="w-8 h-8 text-blue-400" />
            </div>
            <CardTitle className="text-2xl text-white">{groupInfo?.group_name}</CardTitle>
            <CardDescription className="text-slate-400">
              {groupInfo?.description || "Enter your passcode to access this group"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Your Passcode
                </Label>
                <Input
                  type="text"
                  placeholder="e.g., happy-star-42"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="h-12 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 text-center text-lg"
                  data-testid="member-passcode-input"
                />
                <p className="text-xs text-slate-500 text-center">
                  Your passcode was provided by the group moderator
                </p>
              </div>
              
              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold"
                disabled={loggingIn}
                data-testid="member-login-btn"
              >
                {loggingIn ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="w-5 h-5 mr-2" />
                )}
                Enter Group
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-slate-500 text-sm mt-6">
          Don't have a passcode? Contact your group moderator.
        </p>
      </div>
    </div>
  );
};

export default GroupAccess;
