import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { apiClient } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { 
  FileText,
  User,
  Users,
  Target,
  Play,
  Trash2,
  Plus,
  LogIn,
  Settings
} from "lucide-react";
import { format } from "date-fns";

const actionIcons = {
  REGISTER: User,
  LOGIN: LogIn,
  CREATE: Plus,
  UPDATE: Settings,
  DELETE: Trash2,
  ADD_MEMBER: Users,
  REMOVE_MEMBER: Trash2,
  START_SESSION: Play,
  END_SESSION: Target,
  SPIN: Target
};

const actionColors = {
  REGISTER: "bg-emerald-500/10 text-emerald-500",
  LOGIN: "bg-blue-500/10 text-blue-500",
  CREATE: "bg-violet-500/10 text-violet-500",
  UPDATE: "bg-amber-500/10 text-amber-500",
  DELETE: "bg-red-500/10 text-red-500",
  ADD_MEMBER: "bg-emerald-500/10 text-emerald-500",
  REMOVE_MEMBER: "bg-red-500/10 text-red-500",
  START_SESSION: "bg-blue-500/10 text-blue-500",
  END_SESSION: "bg-violet-500/10 text-violet-500",
  SPIN: "bg-amber-500/10 text-amber-500"
};

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await apiClient.get("/audit-logs?limit=100");
        setLogs(res.data);
      } catch (error) {
        console.error("Failed to load audit logs");
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const getIcon = (action) => {
    const Icon = actionIcons[action] || FileText;
    return Icon;
  };

  return (
    <Layout title="Audit Logs">
      <p className="text-muted-foreground mb-8">Track all activity in your account</p>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No activity recorded yet</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-3">
                {logs.map((log, index) => {
                  const Icon = getIcon(log.action);
                  return (
                    <div
                      key={log.id}
                      className="flex items-start gap-4 p-4 rounded-xl border border-border/50 bg-card animate-fade-in-up"
                      style={{ animationDelay: `${index * 20}ms` }}
                      data-testid={`audit-log-${log.id}`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${actionColors[log.action] || "bg-muted"}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-mono text-xs">
                            {log.action}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            on {log.entity_type}
                          </span>
                        </div>
                        {log.details && (
                          <p className="text-sm mt-1 truncate">{log.details}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
};

export default AuditLogs;
