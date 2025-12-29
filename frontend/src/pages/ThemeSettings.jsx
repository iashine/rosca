import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { useTheme } from "../App";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { 
  Palette, 
  Save,
  RotateCcw,
  Loader2
} from "lucide-react";

const defaultColors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEEAD", "#D4A5A5"];

const ThemeSettings = () => {
  const { wheelTheme, setWheelTheme, loadWheelTheme, saveWheelTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      await loadWheelTheme();
      setLoading(false);
    };
    init();
  }, [loadWheelTheme]);

  const handleColorChange = (index, color) => {
    const newColors = [...wheelTheme.wheel_colors];
    newColors[index] = color;
    setWheelTheme({ ...wheelTheme, wheel_colors: newColors });
  };

  const addColor = () => {
    if (wheelTheme.wheel_colors.length >= 12) {
      toast.error("Maximum 12 colors allowed");
      return;
    }
    const newColor = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
    setWheelTheme({ 
      ...wheelTheme, 
      wheel_colors: [...wheelTheme.wheel_colors, newColor] 
    });
  };

  const removeColor = (index) => {
    if (wheelTheme.wheel_colors.length <= 2) {
      toast.error("Minimum 2 colors required");
      return;
    }
    const newColors = wheelTheme.wheel_colors.filter((_, i) => i !== index);
    setWheelTheme({ ...wheelTheme, wheel_colors: newColors });
  };

  const handleSave = async () => {
    setSaving(true);
    await saveWheelTheme(wheelTheme);
    setSaving(false);
  };

  const handleReset = () => {
    setWheelTheme({
      ...wheelTheme,
      wheel_colors: [...defaultColors]
    });
    toast.info("Colors reset to default");
  };

  if (loading) {
    return (
      <Layout title="Theme Settings">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Theme Settings">
      <p className="text-muted-foreground mb-8">Customize your spinning wheel appearance</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Color Settings */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Wheel Colors
            </CardTitle>
            <CardDescription>
              Customize the colors used for wheel segments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {wheelTheme.wheel_colors.map((color, index) => (
                <div key={index} className="relative group">
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Color {index + 1}
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => handleColorChange(index, e.target.value)}
                      className="w-12 h-12 rounded-lg cursor-pointer border-2 border-border"
                      data-testid={`color-picker-${index}`}
                    />
                    <Input
                      value={color}
                      onChange={(e) => handleColorChange(index, e.target.value)}
                      className="font-mono text-sm h-10"
                      data-testid={`color-input-${index}`}
                    />
                  </div>
                  {wheelTheme.wheel_colors.length > 2 && (
                    <button
                      onClick={() => removeColor(index)}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`remove-color-${index}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {wheelTheme.wheel_colors.length < 12 && (
              <Button variant="outline" onClick={addColor} className="w-full" data-testid="add-color-btn">
                + Add Color
              </Button>
            )}

            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={handleReset}
                className="flex-1"
                data-testid="reset-colors-btn"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset to Default
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="flex-1"
                data-testid="save-theme-btn"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Theme
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              See how your colors will look on the wheel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <div className="relative">
                <svg width="300" height="300" viewBox="0 0 300 300">
                  {wheelTheme.wheel_colors.map((color, index) => {
                    const total = wheelTheme.wheel_colors.length;
                    const startAngle = (index / total) * 360;
                    const endAngle = ((index + 1) / total) * 360;
                    
                    const startRad = (startAngle - 90) * Math.PI / 180;
                    const endRad = (endAngle - 90) * Math.PI / 180;
                    
                    const x1 = 150 + 130 * Math.cos(startRad);
                    const y1 = 150 + 130 * Math.sin(startRad);
                    const x2 = 150 + 130 * Math.cos(endRad);
                    const y2 = 150 + 130 * Math.sin(endRad);
                    
                    const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
                    
                    return (
                      <path
                        key={index}
                        d={`M 150 150 L ${x1} ${y1} A 130 130 0 ${largeArc} 1 ${x2} ${y2} Z`}
                        fill={color}
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth="2"
                      />
                    );
                  })}
                  <circle cx="150" cy="150" r="25" fill="#1e293b" stroke="#3b82f6" strokeWidth="3" />
                </svg>
                {/* Arrow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2">
                  <svg width="30" height="30" viewBox="0 0 30 30">
                    <polygon points="15,25 5,5 25,5" fill="#3b82f6" stroke="#1e293b" strokeWidth="2" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Color swatches */}
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {wheelTheme.wheel_colors.map((color, index) => (
                <div
                  key={index}
                  className="w-8 h-8 rounded-lg shadow-sm"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ThemeSettings;
