import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Sun, Moon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

const PaintFlow = ({ theme, toggleTheme }) => {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    if (password === "432122") {
      setAuthenticated(true);
    } else {
      alert("Yanlış şifre!");
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="text-3xl font-heading text-center">BOYA GİRİŞİ</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                data-testid="paint-password-input"
                type="password"
                placeholder="Şifre..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleLogin()}
                className="mb-4 bg-background border-border text-text-primary text-lg h-14"
              />
              <Button data-testid="paint-login-button" onClick={handleLogin} className="w-full bg-pink-500 text-white hover:bg-pink-600 h-14 text-lg font-heading">
                Giriş Yap
              </Button>
              <Button variant="outline" onClick={() => navigate("/")} className="w-full mt-4 border-border bg-background hover:bg-surface-highlight">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Ana Sayfa
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Button variant="outline" onClick={() => navigate("/")} data-testid="back-button" className="border-border bg-surface hover:bg-surface-highlight">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Ana Sayfa
          </Button>
          <Button variant="outline" size="icon" onClick={toggleTheme} data-testid="theme-toggle" className="border-border bg-surface hover:bg-surface-highlight">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>

        <h1 className="text-5xl font-heading font-black text-pink-500 mb-12">
          BOYA YÖNETİMİ
        </h1>

        <Card className="bg-surface border-border">
          <CardContent className="p-8 text-center">
            <p className="text-text-primary text-xl">Boya modülü hazırlanıyor...</p>
            <p className="text-text-secondary mt-4">Şu anda geliştirme aşamasındadır.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaintFlow;
