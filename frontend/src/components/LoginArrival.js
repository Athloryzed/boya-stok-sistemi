import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocation, useNavigationType } from "react-router-dom";
import { LOGIN_MOTION } from "../lib/motion";

// Inside Suspense: the arrival starts when the destination chunk is ready.
// POP navigation (back/reload) never replays the login camera movement.
export default function LoginArrival({ children, liteMode }) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const reduced = useReducedMotion();
  const dive = !liteMode && !reduced && navigationType === "PUSH" && location.state?.loginDive;
  return (
    <motion.div key={location.pathname}
      initial={dive ? { opacity: 0, scale: 0.96, y: 12 } : false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: dive ? LOGIN_MOTION.arrive : 0, ease: LOGIN_MOTION.ease }}
      style={{ minHeight: "100vh", transformOrigin: "50% 35%" }}>
      {children}
    </motion.div>
  );
}
