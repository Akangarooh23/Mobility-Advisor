import React, { useRef, useEffect, useState } from "react";
import "./CircularSteps.css";

const STEPS = [
  {
    tag: "Paso 1",
    title: "Quiero comprar un vehículo",
    desc: "Explora nuestro catálogo de vehículos nuevos y de ocasión. Te asesoramos para encontrar el modelo que mejor se adapta a tus necesidades y presupuesto.",
    icon: "🚗",
    color: "#1D9E75",
    cls: "step-1",
  },
  {
    tag: "Paso 2",
    title: "Quiero contratar un Servicio",
    desc: "Únete a una nueva era en la automoción y aprovecha las economías de escala de una empresa en la unión de los particulares.",
    icon: "🔧",
    color: "#378ADD",
    cls: "step-2",
  },
  {
    tag: "Paso 3",
    title: "Quiero vender mi coche",
    desc: "¿Cansado de que los concesionarios te ofrezcan mucho menos de lo que vale tu coche? Te ayudamos a que ganes más.",
    icon: "💵",
    color: "#D85A30",
    cls: "step-3",
  },
];

const ARROW_COLORS = ["#1D9E75", "#378ADD", "#D85A30"];
const STEP_DURATION = 4000;
const ANIM_DURATION = 500;

export default function CircularSteps() {
  const canvasRef = useRef(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const progressBarRef = useRef(null);
  const autoTimer = useRef(null);
  const goToStepRef = useRef(null);
  const renderArrowsRef = useRef(null);

  // Arc definitions
  const W = 240, H = 240, cx = 120, cy = 120, R = 84;
  const GAP = 0.22;
  const ARC = (2 * Math.PI - 3 * GAP) / 3;
  const arcs = [
    { start: -Math.PI / 2, sweep: ARC },
    { start: -Math.PI / 2 + ARC + GAP, sweep: ARC },
    { start: -Math.PI / 2 + 2 * (ARC + GAP), sweep: ARC },
  ];

  // Drawing helpers
  function drawArc(ctx, startAngle, sweepAngle, color, alpha) {
    if (sweepAngle <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(cx, cy, R, startAngle, startAngle + sweepAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 34;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
  }
  function drawArrowhead(ctx, startAngle, sweepAngle, color, alpha) {
    if (sweepAngle <= 0) return;
    const tipA = startAngle + sweepAngle;
    const tx = cx + R * Math.cos(tipA);
    const ty = cy + R * Math.sin(tipA);
    const tangent = tipA + Math.PI / 2;
    const hs = 16, hl = 20;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(tx + hs * Math.cos(tangent - 0.55), ty + hs * Math.sin(tangent - 0.55));
    ctx.lineTo(tx + hl * Math.cos(tangent), ty + hl * Math.sin(tangent));
    ctx.lineTo(tx + hs * Math.cos(tangent + 0.55), ty + hs * Math.sin(tangent + 0.55));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }
  function renderArrows(ctx, filledCount, partialFill = 0) {
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < 3; i++) {
      const { start, sweep } = arcs[i];
      if (i < filledCount) {
        drawArc(ctx, start, sweep, ARROW_COLORS[i], 1);
        drawArrowhead(ctx, start, sweep, ARROW_COLORS[i], 1);
      } else if (i === filledCount && partialFill > 0) {
        const partialSweep = sweep * partialFill;
        drawArc(ctx, start, partialSweep, ARROW_COLORS[i], 1);
        if (partialFill > 0.7) drawArrowhead(ctx, start, partialSweep, ARROW_COLORS[i], (partialFill - 0.7) / 0.3);
        drawArc(ctx, start, sweep, ARROW_COLORS[i], 0.12);
      } else {
        drawArc(ctx, start, sweep, ARROW_COLORS[i], 0.12);
      }
    }
  }

  renderArrowsRef.current = renderArrows;

  // Animation logic
  function animateTo(targetFilled, fromFilled, callback) {
    setAnimating(true);
    const ctx = canvasRef.current.getContext("2d");
    const start = performance.now();
    function frame(now) {
      const t = Math.min((now - start) / ANIM_DURATION, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      ctx.clearRect(0, 0, W, H);
      if (targetFilled === 0) {
        for (let i = 0; i < 3; i++) {
          const { start: s, sweep } = arcs[i];
          drawArc(ctx, s, sweep, ARROW_COLORS[i], 0.12);
        }
      } else {
        for (let i = 0; i < 3; i++) {
          const { start: s, sweep } = arcs[i];
          if (i < fromFilled) {
            drawArc(ctx, s, sweep, ARROW_COLORS[i], 1);
            drawArrowhead(ctx, s, sweep, ARROW_COLORS[i], 1);
          } else if (i === fromFilled && targetFilled > fromFilled) {
            const partialSweep = sweep * ease;
            drawArc(ctx, s, sweep, ARROW_COLORS[i], 0.12);
            drawArc(ctx, s, partialSweep, ARROW_COLORS[i], 1);
            if (ease > 0.7) drawArrowhead(ctx, s, partialSweep, ARROW_COLORS[i], (ease - 0.7) / 0.3);
          } else {
            drawArc(ctx, s, sweep, ARROW_COLORS[i], 0.12);
          }
        }
      }
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        renderArrows(ctx, targetFilled);
        setAnimating(false);
        if (callback) callback();
      }
    }
    requestAnimationFrame(frame);
  }

  // Progress bar
  function startProgress(color) {
    const bar = progressBarRef.current;
    if (!bar) return;
    bar.style.transition = "none";
    bar.style.width = "0%";
    bar.style.background = color;
    void bar.offsetWidth;
    bar.style.transition = `width ${STEP_DURATION}ms linear`;
    bar.style.width = "100%";
  }
  // Step navigation
  function goToStep(newStep, fromStep, skipAnimation) {
    if (animating) return;
    const prev = fromStep;
    const next = newStep;
    const ctx = canvasRef.current.getContext("2d");
    if (skipAnimation) {
      renderArrows(ctx, next + 1, 0);
      setCurrentStep(next);
      startProgress(STEPS[next].color);
      return;
    }
    if (next === 0 && prev === 2) {
      animateTo(0, 0, () => {
        animateTo(1, 0, () => {
          setCurrentStep(0);
          startProgress(STEPS[0].color);
        });
      });
      renderArrows(ctx, 0, 0);
    } else {
      animateTo(next + 1, prev + 1 > next + 1 ? 0 : prev, () => {
        startProgress(STEPS[next].color);
      });
      setCurrentStep(next);
    }
  }

  goToStepRef.current = goToStep;

  // Button handlers
  // Eliminar controles de navegación manual y pausa

  // Init
  useEffect(() => {
    renderArrowsRef.current?.(canvasRef.current.getContext("2d"), 0, 0);
    setTimeout(() => {
      goToStepRef.current?.(0, -1, false);
    }, 400);
    return () => clearTimeout(autoTimer.current);
  }, []);

  useEffect(() => {
    clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      if (animating) {
        return;
      }
      const next = (currentStep + 1) % 3;
      goToStepRef.current?.(next, currentStep, false);
    }, STEP_DURATION);

    return () => clearTimeout(autoTimer.current);
  }, [currentStep, animating]);

  // Dots update
  useEffect(() => {
    // handled by React render
  }, [currentStep]);

  return (
    <div className="cw-circular-steps-page cw-horizontal-layout">
      <div className="cw-circular-left-stack">
        {/* Header siempre visible, sin scroll ni overflow */}
        <div className="cw-circular-header" style={{ marginBottom: 0, minWidth: 0 }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset' }}>
            ¿Qué deseas hacer hoy?
          </h1>
          <p style={{ margin: 0, fontSize: '0.95rem', color: '#6B6B6B', fontWeight: 300, whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset' }}>
            Selecciona tu opción y te guiamos en cada paso
          </p>
        </div>
        <div className="cw-canvas-wrap">
          <canvas ref={canvasRef} width={W} height={H}></canvas>
          <div className="cw-center-badge">
            <span className="cw-step-num" style={{ color: STEPS[currentStep].color }}>{currentStep + 1}</span>
            <span className="cw-step-label">de 3</span>
          </div>
        </div>
      </div>
      <div className="cw-info-card-side">
        <div className={`cw-info-card ${STEPS[currentStep].cls}`}>
          <div className="cw-card-icon">{STEPS[currentStep].icon}</div>
          <div className="cw-card-body">
            <span className="cw-card-tag">{STEPS[currentStep].tag}</span>
            <h2>{STEPS[currentStep].title}</h2>
            <p>{STEPS[currentStep].desc}</p>
          </div>
        </div>
        <div className="cw-dots">
          {STEPS.map((_, i) => (
            <div key={i} className={"cw-dot" + (i <= currentStep ? " active" : "")}
              data-step={i}
              style={i === 0 ? { background: i === currentStep ? ARROW_COLORS[0] : undefined }
                : i === 1 ? { background: i === currentStep ? ARROW_COLORS[1] : undefined }
                : { background: i === currentStep ? ARROW_COLORS[2] : undefined }}
              onClick={() => { if (!animating) goToStep(i, currentStep, false); }}
            ></div>
          ))}
        </div>
        <div className="cw-progress-bar-wrap">
          <div className="cw-progress-bar" ref={progressBarRef}></div>
        </div>
      </div>
    </div>
  );
}
