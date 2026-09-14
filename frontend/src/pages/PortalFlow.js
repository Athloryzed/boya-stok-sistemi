import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Package } from "lucide-react";
import PortalPanel from "../components/PortalPanel";

const PortalFlow = ({ theme }) => {
  const navigate = useNavigate();

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-background" : "bg-gray-50"}`}>
      <div className="max-w-lg mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <div className="float-soft icon-tile-glow w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/25 to-blue-600/5 border border-blue-500/40 flex items-center justify-center" style={{ "--glow-rgb": "59,130,246" }}>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-text-primary tracking-tight">
              Sipariş Takip
            </h1>
            <p className="text-xs text-text-secondary font-mono uppercase tracking-widest mt-1">Buse Kağıt · Müşteri Portalı</p>
          </div>

          <PortalPanel onHomeClick={() => navigate("/")} />
        </motion.div>
      </div>
    </div>
  );
};

export default PortalFlow;
