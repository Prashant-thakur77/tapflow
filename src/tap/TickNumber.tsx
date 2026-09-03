import React, { useEffect } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

/** A number that glides to its new value instead of jumping. */
export const TickNumber: React.FC<{ value: number; format: (n: number) => string; className?: string; style?: React.CSSProperties }> = ({
  value,
  format,
  className,
  style,
}) => {
  const spring = useSpring(value, { stiffness: 140, damping: 22, mass: 0.6 });
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);
  const text = useTransform(spring, (v) => format(v));
  return (
    <motion.span className={className} style={style}>
      {text}
    </motion.span>
  );
};
