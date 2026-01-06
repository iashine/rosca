import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { 
  Users, 
  Shield, 
  RefreshCw, 
  History, 
  Palette, 
  Lock,
  ArrowRight,
  CheckCircle2,
  Sparkles
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Group Management",
    description: "Create and manage multiple ROSCA groups with unlimited members."
  },
  {
    icon: RefreshCw,
    title: "Fair Spinning",
    description: "Cryptographically secure random selection ensures fair winner picks."
  },
  {
    icon: History,
    title: "Full History",
    description: "Complete audit trail of every spin with replay functionality."
  },
  {
    icon: Palette,
    title: "Customization",
    description: "Personalize your wheel colors and theme preferences."
  },
  {
    icon: Shield,
    title: "Secure Access",
    description: "Email verification and role-based access control."
  },
  {
    icon: Lock,
    title: "Data Protection",
    description: "Your group and member data is securely stored and encrypted."
  }
];

const steps = [
  {
    number: "01",
    title: "Create an Account",
    description: "Sign up as a moderator with email verification to get started."
  },
  {
    number: "02",
    title: "Set Up Your Group",
    description: "Create a ROSCA group and add all participating members."
  },
  {
    number: "03",
    title: "Start Spinning",
    description: "Each cycle, spin the wheel to fairly select the next recipient."
  },
  {
    number: "04",
    title: "Track Progress",
    description: "Monitor your group's history and replay past sessions anytime."
  }
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <span className="text-xl font-bold text-white">R</span>
              </div>
              <span className="text-xl font-bold text-white tracking-tight">ROSCA Spin</span>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/login">
                <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800" data-testid="landing-login-btn">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25" data-testid="landing-register-btn">
                  Get Started <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8">
              <Sparkles className="w-4 h-4" />
              Trusted by savings groups worldwide
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-6">
              Manage Your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                Rotating Savings
              </span>{" "}
              Groups with Ease
            </h1>
            <p className="text-lg sm:text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
              ROSCA Spin provides a fair, transparent, and secure way to manage your community savings circles. 
              Spin the wheel and let luck decide who receives the pot next.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register">
                <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-8 h-12 text-lg shadow-xl shadow-blue-500/25" data-testid="hero-get-started-btn">
                  Get Started Free <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white px-8 h-12 text-lg">
                  Sign In to Dashboard
                </Button>
              </Link>
            </div>
          </div>

          {/* Hero Image/Illustration */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent z-10" />
            <div className="relative rounded-2xl overflow-hidden border border-slate-700/50 bg-slate-800/50 backdrop-blur shadow-2xl">
              <div className="aspect-video flex items-center justify-center p-8">
                {/* Animated Wheel Preview */}
                <div className="relative w-64 h-64 sm:w-80 sm:h-80">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 animate-pulse" />
                  <svg viewBox="0 0 200 200" className="w-full h-full animate-spin-slow">
                    <circle cx="100" cy="100" r="90" fill="none" stroke="url(#wheelGradient)" strokeWidth="8" />
                    {[0, 60, 120, 180, 240, 300].map((angle, i) => (
                      <g key={i} transform={`rotate(${angle}, 100, 100)`}>
                        <path
                          d={`M100,100 L100,15 A85,85 0 0,1 ${100 + 85 * Math.sin(Math.PI / 3)},${100 - 85 * Math.cos(Math.PI / 3)} Z`}
                          fill={['#3b82f6', '#6366f1', '#8b5cf6', '#0ea5e9', '#14b8a6', '#64748b'][i]}
                          opacity="0.8"
                        />
                      </g>
                    ))}
                    <circle cx="100" cy="100" r="20" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                    <defs>
                      <linearGradient id="wheelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#6366f1" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2">
                    <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-blue-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/30" id="features">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything You Need
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Powerful features to manage your savings groups efficiently and transparently.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card 
                  key={index} 
                  className="bg-slate-800/50 border-slate-700/50 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1"
                  data-testid={`feature-card-${index}`}
                >
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                    <p className="text-slate-400">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8" id="how-it-works">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Get started in minutes with our simple four-step process.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="relative" data-testid={`step-${index}`}>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[60%] w-full h-0.5 bg-gradient-to-r from-blue-500/50 to-transparent" />
                )}
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-2xl font-bold mb-4 shadow-lg shadow-blue-500/25">
                    {step.number}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-slate-400">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
                Why Choose ROSCA Spin?
              </h2>
              <div className="space-y-4">
                {[
                  "Transparent and fair selection process",
                  "Complete history and audit trail",
                  "Secure email verification",
                  "Mobile-friendly interface",
                  "Customizable wheel themes",
                  "Free to use for all groups"
                ].map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <span className="text-slate-300">{benefit}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <Link to="/register">
                  <Button size="lg" className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-8">
                    Start Managing Your Group <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-3xl" />
              <Card className="bg-slate-800/80 border-slate-700/50 backdrop-blur">
                <CardContent className="p-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-700/50">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">10+</p>
                        <p className="text-sm text-slate-400">Members per group</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-700/50">
                      <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">100%</p>
                        <p className="text-sm text-slate-400">Fair random selection</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-700/50">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">Secure</p>
                        <p className="text-sm text-slate-400">Email verified accounts</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-slate-400 mb-8">
            Join thousands of savings groups already using ROSCA Spin for fair and transparent member selection.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-8 h-12 text-lg shadow-xl shadow-blue-500/25" data-testid="cta-register-btn">
                Create Free Account <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-slate-700/50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <span className="text-sm font-bold text-white">R</span>
            </div>
            <span className="text-slate-400">© 2025 ROSCA Spin. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="text-slate-400 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link to="/register" className="text-slate-400 hover:text-white transition-colors">
              Register
            </Link>
          </div>
        </div>
      </footer>

      {/* Custom CSS for slow spin animation */}
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Landing;
