import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { apiClient } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { 
  ArrowLeft,
  Trophy,
  Calendar,
  Clock,
  Play,
  Pause
} from "lucide-react";
import { format } from "date-fns";

const SessionReplay = () => {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [spinResults, setSpinResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replayIndex, setReplayIndex] = useState(-1);
  const [isReplaying, setIsReplaying] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const [sessionRes, spinsRes] = await Promise.all([
          apiClient.get(`/sessions/${sessionId}`),
          apiClient.get(`/sessions/${sessionId}/spins`)
        ]);
        setSession(sessionRes.data);
        setSpinResults(spinsRes.data);
      } catch (error) {
        console.error("Failed to load session");
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  // Replay animation
  useEffect(() => {
    let timer;
    if (isReplaying && replayIndex < spinResults.length - 1) {
      timer = setTimeout(() => {
        setReplayIndex(prev => prev + 1);
      }, 1500);
    } else if (replayIndex >= spinResults.length - 1) {
      setIsReplaying(false);
    }
    return () => clearTimeout(timer);
  }, [isReplaying, replayIndex, spinResults.length]);

  const startReplay = () => {
    setReplayIndex(-1);
    setIsReplaying(true);
    setTimeout(() => setReplayIndex(0), 500);
  };

  const pauseReplay = () => {
    setIsReplaying(false);
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Session Info */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Session Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Spins</p>
              <p className="text-2xl font-bold">{spinResults.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="font-medium">
                {session.ended_at 
                  ? `${Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 60000)} minutes`
                  : "In progress"
                }
              </p>
            </div>
            {session.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="font-medium">{session.notes}</p>
              </div>
            )}

            {spinResults.length > 0 && (
              <div className="pt-4">
                <Button
                  onClick={isReplaying ? pauseReplay : startReplay}
                  className="w-full"
                  variant="outline"
                  data-testid="replay-btn"
                >
                  {isReplaying ? (
                    <>
                      <Pause className="w-4 h-4 mr-2" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" /> Replay Session
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Timeline */}
        <Card className="border-border/50 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Results Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {spinResults.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No spins recorded in this session</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {spinResults.map((result, index) => (
                    <div
                      key={result.id}
                      className={`relative flex items-start gap-4 p-4 rounded-xl border transition-all duration-500 ${
                        replayIndex >= index 
                          ? "border-amber-500/50 bg-amber-500/5" 
                          : "border-border/50 bg-card opacity-50"
                      }`}
                      data-testid={`replay-result-${index}`}
                    >
                      {/* Timeline line */}
                      {index < spinResults.length - 1 && (
                        <div className={`absolute left-[2.1rem] top-[4rem] w-0.5 h-8 transition-colors duration-500 ${
                          replayIndex > index ? "bg-amber-500/50" : "bg-border"
                        }`} />
                      )}
                      
                      {/* Spin number badge */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500 ${
                        replayIndex >= index 
                          ? "bg-amber-500 text-white" 
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {result.spin_number}
                      </div>
                      
                      {/* Result info */}
                      <div className="flex-1">
                        <p className={`font-semibold text-lg transition-colors duration-500 ${
                          replayIndex >= index ? "text-foreground" : "text-muted-foreground"
                        }`}>
                          {result.winner_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(result.created_at), "h:mm:ss a")}
                        </p>
                      </div>

                      {/* Winner trophy */}
                      {replayIndex >= index && (
                        <Trophy className="w-5 h-5 text-amber-500 animate-bounce" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default SessionReplay;
