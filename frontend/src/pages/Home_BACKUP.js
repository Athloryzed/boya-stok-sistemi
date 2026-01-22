import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Settings, Users, ClipboardList, Package, Sun, Moon } from "lucide-react";
import { Button } from "../components/ui/button";

const Home = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();

  const modules = [
    {
      title: "Yönetim",
      icon: Settings,
      path: "/management",
      color: "#FFBF00",
      testId: "management-module"
    },
    {
      title: "Operatör",
      icon: Users,
      path: "/operator",
      color: "#007AFF",
      testId: "operator-module"
    },
    {
      title: "Plan",
      icon: ClipboardList,
      path: "/plan",
      color: "#10B981",
      testId: "plan-module"
    },
    {
      title: "Depo",
      icon: Package,
      path: "/warehouse",
      color: "#F59E0B",
      testId: "warehouse-module"
    }
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-10"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1767294274634-613a3545e36d?crop=entropy&cs=srgb&fm=jpg&q=85')" }}
      />
      
      <div className="relative z-10">
        <div className="absolute top-6 right-6">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            data-testid="theme-toggle"
            className="border-border bg-surface hover:bg-surface-highlight"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>

        <div className="container mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h1 className="text-6xl md:text-7xl font-heading font-black text-primary mb-4 tracking-tight">
              BUSE KAĞIT
            </h1>
            <p className="text-xl text-text-secondary font-body">
              Üretim Yönetim Sistemi
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {modules.map((module, index) => {
              const Icon = module.icon;
              return (
                <motion.div
                  key={module.title}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <button
                    onClick={() => navigate(module.path)}
                    data-testid={module.testId}
                    className="w-full h-64 bg-surface border border-border rounded-xl p-8 flex flex-col items-center justify-center gap-6 machine-card-hover group"
                    style={{
                      boxShadow: `0 0 0 0 ${module.color}00`
                    }}
                  >
                    <div 
                      className="w-24 h-24 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${module.color}20` }}
                    >
                      <Icon className="w-12 h-12" style={{ color: module.color }} />
                    </div>
                    <h2 className="text-3xl font-heading font-bold text-text-primary">
                      {module.title}
                    </h2>
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
