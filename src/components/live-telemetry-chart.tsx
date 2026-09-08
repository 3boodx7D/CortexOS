import { useEffect, useRef } from 'react';
import type { TelemetryDataPoint } from '@/pages/overview';

export function LiveTelemetryChart({ 
  data, 
  motionMode = 'cinematic' 
}: { 
  data: TelemetryDataPoint[];
  motionMode?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef(data);
  const lastUpdateTimeRef = useRef(performance.now());
  const isFastMode = motionMode === 'minimal' || motionMode === 'fast';

  // Update refs when new data arrives
  useEffect(() => {
    dataRef.current = data;
    lastUpdateTimeRef.current = performance.now();
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastDrawTime = 0;

    const drawChart = (progress: number) => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }

      const W = rect.width;
      const H = rect.height;

      ctx.clearRect(0, 0, W, H);

      const currentData = dataRef.current;
      if (currentData.length < 2) return;

      const N = currentData.length;
      const pointSpacing = W / (N - 2);
      const paddingY = 12;
      const usableH = H - paddingY * 2;
      const bottomY = H - paddingY;

      // Draw subtle background grid
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;
      for (let i = 0; i < N + 1; i++) {
        const x = (i - progress) * pointSpacing;
        if (x >= 0 && x <= W) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, H);
        }
      }
      for (let i = 0; i < 4; i++) {
        const y = (i / 3) * H;
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();

      const getPoints = (key: keyof TelemetryDataPoint) => {
        return currentData.map((d, i) => {
          const val = Math.max(0, Math.min(100, d[key] || 0));
          const x = (i - progress) * pointSpacing;
          const y = bottomY - (val / 100) * usableH;
          return { x, y };
        });
      };

      const drawLines = (pts: { x: number; y: number }[]) => {
        if (pts.length === 0) return;
        ctx.moveTo(pts[0].x, pts[0].y);

        if (isFastMode) {
          // FAST Mode: Straight crisp line segments (Low CPU/GPU footprint)
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
        } else {
          // STUDIO SMOOTH: Clamped smooth cubic bezier curves (Prevents negative dip)
          for (let i = 0; i < pts.length - 1; i++) {
            const p0 = i > 0 ? pts[i - 1] : pts[0];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = i !== pts.length - 2 ? pts[i + 2] : p2;

            let cp1x = p1.x + (p2.x - p0.x) / 6;
            let cp1y = p1.y + (p2.y - p0.y) / 6;
            let cp2x = p2.x - (p3.x - p1.x) / 6;
            let cp2y = p2.y - (p3.y - p1.y) / 6;

            // Clamping control points to avoid dipping below the baseline
            cp1y = Math.min(bottomY, Math.max(paddingY, cp1y));
            cp2y = Math.min(bottomY, Math.max(paddingY, cp2y));

            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
          }
        }
      };

      const drawMetric = (points: { x: number; y: number }[], color: string, shadowColor: string) => {
        ctx.beginPath();
        drawLines(points);
        if (!isFastMode) {
          ctx.shadowColor = shadowColor;
          ctx.shadowBlur = 8;
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.shadowBlur = 0;
      };

      const cpuPoints = getPoints('cpu');
      const ramPoints = getPoints('ram');
      const gpuPoints = getPoints('gpu');

      // Draw Area Gradient for CPU
      ctx.beginPath();
      ctx.moveTo(cpuPoints[0].x, H);
      drawLines(cpuPoints);
      ctx.lineTo(cpuPoints[cpuPoints.length - 1].x, H);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, 'rgba(22, 212, 233, 0.12)');
      gradient.addColorStop(1, 'rgba(22, 212, 233, 0.0)');
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw metric series in distinct layers
      drawMetric(ramPoints, '#a78bfa', 'rgba(167, 139, 250, 0.5)'); // Violet RAM
      drawMetric(gpuPoints, '#4ade80', 'rgba(74, 222, 128, 0.5)'); // Green GPU
      drawMetric(cpuPoints, '#16d4e9', 'rgba(22, 212, 233, 0.7)'); // Cyan CPU
    };

    if (isFastMode) {
      // In FAST Mode: zero loop animation. Draw statically on data update or resize.
      drawChart(1.0);
      const onResize = () => drawChart(1.0);
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    } else {
      // In STUDIO SMOOTH Mode: 60 FPS smooth interpolation
      const render = (time: number) => {
        animationFrameId = requestAnimationFrame(render);
        // Smooth target 60 FPS
        if (time - lastDrawTime < 16) return;
        lastDrawTime = time;

        const now = performance.now();
        const timeSinceUpdate = now - lastUpdateTimeRef.current;
        // Clamp progress to 1.0 to prevent stutter/snap-back
        const progress = Math.min(1.0, Math.max(0.0, timeSinceUpdate / 1000.0));
        drawChart(progress);
      };

      animationFrameId = requestAnimationFrame(render);
      return () => cancelAnimationFrame(animationFrameId);
    }
  }, [data, isFastMode]);

  return (
    <canvas 
      ref={canvasRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        display: 'block' 
      }} 
    />
  );
}
