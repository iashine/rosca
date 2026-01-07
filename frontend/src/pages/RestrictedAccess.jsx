import { useEffect, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Globe, ShieldX, MapPin } from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const RestrictedAccess = () => {
  const [geoInfo, setGeoInfo] = useState({
    blocked: true,
    ip: "",
    country_code: "",
    country_name: "",
    message: "Access to this site is restricted in your region."
  });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/geoblocking/check`);
        setGeoInfo(res.data);
      } catch (error) {
        console.error("Failed to check geoblocking status");
      }
    };
    checkStatus();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-slate-800/50 border-slate-700/50 backdrop-blur">
        <CardContent className="p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
            <ShieldX className="w-10 h-10 text-red-500" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">Access Restricted</h1>
          
          <p className="text-slate-400 mb-6">
            {geoInfo.message}
          </p>
          
          {geoInfo.country_name && (
            <div className="flex items-center justify-center gap-2 mb-6 text-slate-500">
              <MapPin className="w-4 h-4" />
              <span>Detected location: {geoInfo.country_name}</span>
            </div>
          )}
          
          <div className="p-4 rounded-lg bg-slate-700/50 mb-6">
            <div className="flex items-center justify-center gap-2 text-slate-400">
              <Globe className="w-4 h-4" />
              <span className="font-mono text-sm">{geoInfo.ip || "Unknown IP"}</span>
            </div>
          </div>
          
          <p className="text-sm text-slate-500">
            If you believe this is an error, please contact the site administrator 
            to request access for your IP address.
          </p>
          
          <Button 
            variant="outline" 
            className="mt-6 border-slate-600 text-slate-300 hover:bg-slate-700"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default RestrictedAccess;
