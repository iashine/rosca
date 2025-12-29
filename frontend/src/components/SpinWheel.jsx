import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

const SpinWheel = ({ 
  members, 
  onSpinEnd, 
  wheelColors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEEAD", "#D4A5A5"],
  isSpinning: externalSpinning,
  setIsSpinning: setExternalSpinning
}) => {
  const canvasRef = useRef(null);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState(null);
  const [showWinner, setShowWinner] = useState(false);
  const spinSound = useRef(null);
  const winSound = useRef(null);
  const membersRef = useRef(members);

  // Keep membersRef in sync with members prop
  useEffect(() => {
    membersRef.current = members;
    // Hide winner overlay when members change (after a spin result is processed)
    setShowWinner(false);
    setWinner(null);
  }, [members]);

  // Initialize sounds
  useEffect(() => {
    // Create audio context for sounds
    try {
      spinSound.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleX1xlprj7t25lGhVb4SXp6uln6WrtLm2sKuprK2trq6urq+wsbGxsLCxsrKysrKytLW1tbW1tri4uLi4ubi4t7e3t7e3t7e3t7i4uLi4uLi4uLi4uLi4uLi4");
      winSound.current = new Audio("data:audio/wav;base64,UklGRl9vT19teleX1xlprj7t25lGhVb4SXp6uln6WrtLm2sKuprK2trq6urq+wsbGxsLCxsrKysrKytLW1tbW1tri4uLi4ubi4t7e3t7e3t7e3t7i4uLi4uLi4uLi4uLi4uLi4");
    } catch (e) {
      console.log("Audio not supported");
    }
  }, []);

  // Draw the wheel
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || members.length === 0) return;

    const ctx = canvas.getContext("2d");
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const sliceAngle = (2 * Math.PI) / members.length;

    members.forEach((member, index) => {
      const startAngle = index * sliceAngle + (rotation * Math.PI) / 180;
      const endAngle = startAngle + sliceAngle;

      // Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();

      // Fill with color
      ctx.fillStyle = wheelColors[index % wheelColors.length];
      ctx.fill();

      // Add border
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.max(12, Math.min(16, 200 / members.length))}px 'Outfit', sans-serif`;
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 3;
      
      // Truncate long names
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

    // Draw center text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SPIN", centerX, centerY);
  }, [members, rotation, wheelColors]);

  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  // Get winner based on current rotation - uses membersRef to get current members at spin time
  const getWinnerIndex = (finalRotation, currentMembers) => {
    const normalizedRotation = ((finalRotation % 360) + 360) % 360;
    const sliceAngle = 360 / currentMembers.length;
    // Arrow is at the top (270 degrees in canvas coordinates, but we adjust for how we draw)
    // The arrow points at angle 270 (top), so we need to find which slice is there
    const pointerAngle = (270 - normalizedRotation + 360) % 360;
    const winnerIndex = Math.floor(pointerAngle / sliceAngle);
    return winnerIndex % currentMembers.length;
  };

  const spin = () => {
    if (externalSpinning || members.length === 0) return;

    // Capture current members at spin start to avoid stale closure issues
    const spinMembers = [...members];
    
    setExternalSpinning(true);
    setShowWinner(false);
    setWinner(null);

    // Play spin sound
    try {
      if (spinSound.current) {
        spinSound.current.currentTime = 0;
        spinSound.current.play().catch(() => {});
      }
    } catch (e) {}

    // Generate cryptographically secure random number
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const randomValue = array[0] / (0xFFFFFFFF + 1);

    // Calculate target rotation (5-10 full rotations + random position)
    const fullRotations = 5 + Math.floor(randomValue * 5);
    const targetIndex = Math.floor(randomValue * spinMembers.length);
    const sliceAngle = 360 / spinMembers.length;
    // Position the winner at the top (arrow position)
    const targetAngle = 270 - (targetIndex * sliceAngle) - (sliceAngle / 2);
    const totalRotation = rotation + (fullRotations * 360) + ((targetAngle - (rotation % 360) + 360) % 360);

    // Animate the spin
    const startRotation = rotation;
    const duration = 5000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out cubic)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentRotation = startRotation + (totalRotation - startRotation) * easeOut;
      setRotation(currentRotation);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Spin complete
        setExternalSpinning(false);
        const winnerIndex = getWinnerIndex(currentRotation, spinMembers);
        const selectedWinner = spinMembers[winnerIndex];
        
        setWinner(selectedWinner);
        setShowWinner(true);

        // Play win sound and confetti
        try {
          if (winSound.current) {
            winSound.current.currentTime = 0;
            winSound.current.play().catch(() => {});
          }
        } catch (e) {}

        // Fire confetti
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: wheelColors
        });

        // Call callback with winner info
        if (onSpinEnd) {
          onSpinEnd(selectedWinner, currentRotation, array[0].toString(16));
        }
      }
    };

    requestAnimationFrame(animate);
  };

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="w-64 h-64 rounded-full border-4 border-dashed border-border flex items-center justify-center mb-4">
          <span className="text-muted-foreground text-lg">No members</span>
        </div>
        <p className="text-muted-foreground">Add members to start spinning!</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center">
      {/* Arrow pointer at the top */}
      <div className="wheel-pointer absolute -top-2 left-1/2 transform -translate-x-1/2 z-10">
        <svg width="40" height="40" viewBox="0 0 40 40">
          <polygon 
            points="20,35 10,10 30,10" 
            fill="#3b82f6"
            stroke="#1e293b"
            strokeWidth="2"
          />
        </svg>
      </div>

      {/* Wheel canvas */}
      <div className="relative wheel-glow rounded-full">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="cursor-pointer rounded-full"
          onClick={!externalSpinning ? spin : undefined}
          data-testid="spin-wheel"
        />
      </div>

      {/* Winner announcement */}
      <AnimatePresence>
        {showWinner && winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-full"
          >
            <div className="winner-card winner-display rounded-2xl p-8 text-center">
              <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wider">Winner!</p>
              <h2 className="text-3xl font-bold text-accent" data-testid="winner-name">
                {winner.name}
              </h2>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SpinWheel;
