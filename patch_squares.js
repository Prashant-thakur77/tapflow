const fs = require('fs');

const path = 'src/Squares.tsx';
let content = fs.readFileSync(path, 'utf8');

// We will completely replace Squares.tsx to implement the "cre settlement" animation.
// Settlement means we have clusters of cells and wandering paths.
const newContent = `import React, { useRef, useEffect } from "react";

interface SquaresProps {
  direction?: "right" | "left" | "up" | "down" | "diagonal";
  speed?: number;
  borderColor?: string;
  squareSize?: number;
  hoverFillColor?: string;
  className?: string;
}

export const Squares: React.FC<SquaresProps> = ({
  direction = "right",
  speed = 1,
  borderColor = "rgba(255, 255, 255, 0.05)",
  squareSize = 40,
  hoverFillColor = "rgba(8, 71, 247, 0.4)",
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const numSquaresX = useRef<number>(0);
  const numSquaresY = useRef<number>(0);
  
  const absoluteOffset = useRef({ x: 0, y: 0 });
  const mousePos = useRef<{ x: number; y: number } | null>(null);

  // For the 'cre settlement' animation: cells that light up and expand, and paths that run
  const activeCells = useRef<Map<string, {
    x: number;
    y: number;
    alpha: number;
    targetAlpha: number;
    color: string;
    life?: number;
  }>>(new Map());

  const agents = useRef<{
    x: number;
    y: number;
    dirX: number;
    dirY: number;
    life: number;
    color: string;
  }[]>([]);

  const addCell = (x: number, y: number, color = hoverFillColor, isPath = false) => {
    const id = \`\${x},\${y}\`;
    if (!activeCells.current.has(id)) {
      activeCells.current.set(id, {
        x,
        y,
        alpha: 0,
        targetAlpha: isPath ? 0.6 : (Math.random() * 0.3 + 0.1),
        color,
        life: isPath ? 60 : undefined
      });
      return true;
    }
    return false;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      numSquaresX.current = Math.ceil(canvas.width / squareSize) + 2;
      numSquaresY.current = Math.ceil(canvas.height / squareSize) + 2;
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    const drawGrid = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const offsetX = absoluteOffset.current.x % squareSize;
      const offsetY = absoluteOffset.current.y % squareSize;

      const negativeOffsetX = offsetX < 0 ? offsetX + squareSize : offsetX;
      const negativeOffsetY = offsetY < 0 ? offsetY + squareSize : offsetY;

      const startX = -squareSize + negativeOffsetX;
      const startY = -squareSize + negativeOffsetY;

      const currentAbsGridX = Math.floor(absoluteOffset.current.x / squareSize);
      const currentAbsGridY = Math.floor(absoluteOffset.current.y / squareSize);

      // Draw active cells
      for (let x = startX; x < canvas.width + squareSize; x += squareSize) {
        for (let y = startY; y < canvas.height + squareSize; y += squareSize) {
          const gridX = Math.floor((x - startX) / squareSize) - currentAbsGridX;
          const gridY = Math.floor((y - startY) / squareSize) - currentAbsGridY;
          const id = \`\${gridX},\${gridY}\`;

          let fillAlpha = 0;
          let color = hoverFillColor;

          // Mouse Hover
          if (mousePos.current) {
            const hoverX = Math.floor((mousePos.current.x - startX) / squareSize) - currentAbsGridX;
            const hoverY = Math.floor((mousePos.current.y - startY) / squareSize) - currentAbsGridY;
            if (hoverX === gridX && hoverY === gridY) {
              fillAlpha = 1;
            }
          }

          // Active cells (settlement / paths)
          const cell = activeCells.current.get(id);
          if (cell) {
            if (fillAlpha === 0) {
              fillAlpha = cell.alpha;
              color = cell.color;
            }
          }

          if (fillAlpha > 0) {
            ctx.fillStyle = color;
            ctx.globalAlpha = fillAlpha;
            ctx.fillRect(x, y, squareSize, squareSize);
            ctx.globalAlpha = 1.0;
          }
        }
      }

      // Draw Grid Lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = borderColor;
      ctx.beginPath();
      for (let x = startX; x < canvas.width + squareSize; x += squareSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }
      for (let y = startY; y < canvas.height + squareSize; y += squareSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();

      // Vignette / Radial Gradient to fade edges
      const gradient = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        Math.sqrt(canvas.width ** 2 + canvas.height ** 2) / 2,
      );
      gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 1)");

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    let tickCounter = 0;

    const updateAnimation = () => {
      const effectiveSpeed = Math.max(speed, 0.1);
      switch (direction) {
        case "right":
          absoluteOffset.current.x += effectiveSpeed;
          break;
        case "left":
          absoluteOffset.current.x -= effectiveSpeed;
          break;
        case "up":
          absoluteOffset.current.y -= effectiveSpeed;
          break;
        case "down":
          absoluteOffset.current.y += effectiveSpeed;
          break;
        case "diagonal":
          absoluteOffset.current.x -= effectiveSpeed;
          absoluteOffset.current.y -= effectiveSpeed;
          break;
      }

      tickCounter++;

      const currentAbsGridX = Math.floor(absoluteOffset.current.x / squareSize);
      const currentAbsGridY = Math.floor(absoluteOffset.current.y / squareSize);
      const startVisibleX = -currentAbsGridX;
      const startVisibleY = -currentAbsGridY;

      // Settlement Growth Logic
      // 1. Spawn new settlement core
      if (Math.random() < 0.01) {
        const randX = startVisibleX + Math.floor(Math.random() * numSquaresX.current);
        const randY = startVisibleY + Math.floor(Math.random() * numSquaresY.current);
        const color = Math.random() > 0.5 ? "rgba(8, 71, 247, 0.3)" : "rgba(46, 189, 133, 0.2)";
        addCell(randX, randY, color);
      }

      // 2. Expand settlement
      if (tickCounter % 10 === 0) {
        const cells = Array.from(activeCells.current.values());
        cells.forEach(cell => {
          if (!cell.life && Math.random() < 0.08) {
            const dirs = [[0,1], [1,0], [0,-1], [-1,0]];
            const dir = dirs[Math.floor(Math.random() * dirs.length)];
            addCell(cell.x + dir[0], cell.y + dir[1], cell.color);
          }
        });
      }

      // 3. Spawn data agents (paths)
      if (Math.random() < 0.05 && agents.current.length < 8) {
        const isHorizontal = Math.random() > 0.5;
        const randX = startVisibleX + Math.floor(Math.random() * numSquaresX.current);
        const randY = startVisibleY + Math.floor(Math.random() * numSquaresY.current);
        
        agents.current.push({
          x: randX,
          y: randY,
          dirX: isHorizontal ? (Math.random() > 0.5 ? 1 : -1) : 0,
          dirY: isHorizontal ? 0 : (Math.random() > 0.5 ? 1 : -1),
          life: Math.floor(Math.random() * 20 + 10),
          color: "rgba(255, 255, 255, 0.6)"
        });
      }

      // 4. Move agents
      if (tickCounter % 3 === 0) {
        for (let i = agents.current.length - 1; i >= 0; i--) {
          const a = agents.current[i];
          addCell(a.x, a.y, a.color, true);
          a.x += a.dirX;
          a.y += a.dirY;
          a.life--;
          
          // Randomly turn
          if (Math.random() < 0.1) {
            if (a.dirX !== 0) {
              a.dirX = 0;
              a.dirY = Math.random() > 0.5 ? 1 : -1;
            } else {
              a.dirY = 0;
              a.dirX = Math.random() > 0.5 ? 1 : -1;
            }
          }

          if (a.life <= 0) {
            agents.current.splice(i, 1);
          }
        }
      }

      // 5. Update alphas and cleanup
      for (const [id, cell] of Array.from(activeCells.current.entries())) {
        if (cell.alpha < cell.targetAlpha) {
          cell.alpha = Math.min(cell.targetAlpha, cell.alpha + 0.05);
        } else if (cell.alpha > cell.targetAlpha) {
          cell.alpha = Math.max(cell.targetAlpha, cell.alpha - 0.05);
        }

        if (cell.life !== undefined) {
          cell.life--;
          if (cell.life <= 0) {
            cell.targetAlpha = 0;
          }
        } else {
          // Settlement eventually dies
          if (Math.random() < 0.001) {
             cell.targetAlpha = 0;
          }
        }

        if (cell.targetAlpha === 0 && cell.alpha <= 0) {
          activeCells.current.delete(id);
        }
      }

      drawGrid();
      requestRef.current = requestAnimationFrame(updateAnimation);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      mousePos.current = { x: mouseX, y: mouseY };
    };

    const handleMouseLeave = () => {
      mousePos.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    requestRef.current = requestAnimationFrame(updateAnimation);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      
      activeCells.current.clear();
      agents.current = [];
    };
  }, [direction, speed, borderColor, hoverFillColor, squareSize]);

  return (
    <canvas
      ref={canvasRef}
      className={\`w-full h-full block border-none \${className}\`}
    ></canvas>
  );
};
`;

fs.writeFileSync(path, newContent);
