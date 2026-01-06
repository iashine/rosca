import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, apiClient } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowRight, ArrowLeft, Mail, CheckCircle2, Calculator, User, Lock } from "lucide-react";

const Register = () => {
  // Multi-step state
  const [step, setStep] = useState(1); // 1: Details, 2: Math, 3: Verify Email
  
  // Form data
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Math challenge
  const [mathChallenge, setMathChallenge] = useState(null);
  const [mathAnswer, setMathAnswer] = useState("");
  
  // Email verification
  const [registrationId, setRegistrationId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Fetch math challenge when moving to step 2
  useEffect(() => {
    if (step === 2 && !mathChallenge) {
      fetchMathChallenge();
    }
  }, [step]);

  const fetchMathChallenge = async () => {
    try {
      const res = await apiClient.get("/auth/math-challenge");
      setMathChallenge(res.data);
    } catch (error) {
      toast.error("Failed to load math challenge");
    }
  };

  const handleStep1Submit = async (e) => {
    e.preventDefault();
    
    if (!name || !email || !password || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    // Move to math challenge step
    setStep(2);
  };

  const handleStep2Submit = async (e) => {
    e.preventDefault();
    
    if (!mathAnswer) {
      toast.error("Please enter your answer");
      return;
    }

    // Validate math answer locally
    const expectedAnswer = calculateExpectedAnswer();
    if (parseInt(mathAnswer) !== expectedAnswer) {
      toast.error("Incorrect answer. Please try again.");
      setMathAnswer("");
      fetchMathChallenge(); // Get new challenge
      return;
    }

    // Submit registration
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/register/init", {
        email,
        password,
        name,
        math_answer: parseInt(mathAnswer)
      });
      
      setRegistrationId(res.data.registration_id);
      toast.success("Verification code sent to your email!");
      setStep(3);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Registration failed");
      // Get new challenge on error
      fetchMathChallenge();
    } finally {
      setLoading(false);
    }
  };

  const handleStep3Submit = async (e) => {
    e.preventDefault();
    
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error("Please enter the 6-digit verification code");
      return;
    }

    setLoading(true);
    try {
      const res = await apiClient.post("/auth/register/verify", {
        registration_id: registrationId,
        verification_code: verificationCode
      });
      
      // Store token and user
      localStorage.setItem("token", res.data.access_token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      
      toast.success("Account created successfully!");
      navigate("/");
      window.location.reload(); // Refresh to update auth state
    } catch (error) {
      toast.error(error.response?.data?.detail || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const calculateExpectedAnswer = () => {
    if (!mathChallenge) return 0;
    const { num1, num2, operation } = mathChallenge;
    switch (operation) {
      case '+': return num1 + num2;
      case '-': return num1 - num2;
      case '*': return num1 * num2;
      default: return 0;
    }
  };

  const goBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center">
          <div 
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
              s < step 
                ? "bg-green-500 text-white" 
                : s === step 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
          </div>
          {s < 3 && (
            <div className={`w-12 h-1 mx-1 rounded ${s < step ? "bg-green-500" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="floating-shapes" />
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg">
              <span className="text-2xl font-bold text-white">R</span>
            </div>
            <span className="text-2xl font-bold tracking-tight">ROSCA Spin</span>
          </Link>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">Create an account</CardTitle>
            <CardDescription>
              {step === 1 && "Enter your details to get started"}
              {step === 2 && "Solve the math problem to verify you're human"}
              {step === 3 && "Enter the verification code sent to your email"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {renderStepIndicator()}

            {/* Step 1: User Details */}
            {step === 1 && (
              <form onSubmit={handleStep1Submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <User className="w-4 h-4" /> Full Name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="register-name"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="register-email"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="register-password"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    data-testid="register-confirm-password"
                    className="h-11"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 font-semibold"
                  data-testid="register-next-btn"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
            )}

            {/* Step 2: Math Challenge */}
            {step === 2 && (
              <form onSubmit={handleStep2Submit} className="space-y-4">
                <div className="text-center p-6 rounded-xl bg-muted/50 border border-border">
                  <Calculator className="w-12 h-12 mx-auto mb-4 text-primary" />
                  <p className="text-sm text-muted-foreground mb-2">Solve this simple math problem:</p>
                  {mathChallenge ? (
                    <p className="text-3xl font-bold" data-testid="math-question">
                      {mathChallenge.num1} {mathChallenge.operation} {mathChallenge.num2} = ?
                    </p>
                  ) : (
                    <div className="animate-pulse h-9 w-32 mx-auto bg-muted rounded" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mathAnswer">Your Answer</Label>
                  <Input
                    id="mathAnswer"
                    type="number"
                    placeholder="Enter your answer"
                    value={mathAnswer}
                    onChange={(e) => setMathAnswer(e.target.value)}
                    data-testid="math-answer-input"
                    className="h-11 text-center text-xl font-semibold"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-11"
                    onClick={goBack}
                    data-testid="math-back-btn"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-11 font-semibold"
                    disabled={loading || !mathChallenge}
                    data-testid="math-submit-btn"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Verify & Continue
                    {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
                  </Button>
                </div>
              </form>
            )}

            {/* Step 3: Email Verification */}
            {step === 3 && (
              <form onSubmit={handleStep3Submit} className="space-y-4">
                <div className="text-center p-6 rounded-xl bg-muted/50 border border-border">
                  <Mail className="w-12 h-12 mx-auto mb-4 text-primary" />
                  <p className="text-sm text-muted-foreground mb-2">
                    We've sent a 6-digit verification code to:
                  </p>
                  <p className="font-semibold text-foreground">{email}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="verificationCode">Verification Code</Label>
                  <Input
                    id="verificationCode"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    data-testid="verification-code-input"
                    className="h-11 text-center text-2xl font-semibold tracking-widest"
                    maxLength={6}
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 font-semibold"
                  disabled={loading || verificationCode.length !== 6}
                  data-testid="verify-submit-btn"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Create Account
                  {!loading && <CheckCircle2 className="w-4 h-4 ml-2" />}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Didn't receive the code?{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => {
                      setStep(2);
                      setMathAnswer("");
                      fetchMathChallenge();
                    }}
                  >
                    Go back and try again
                  </button>
                </p>
              </form>
            )}

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <Link 
                to="/login" 
                className="text-primary font-medium hover:underline"
                data-testid="login-link"
              >
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
