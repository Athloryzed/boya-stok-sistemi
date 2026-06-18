/**
 * CustomerEditDialog — Yeni müşteri ekle / mevcudunu düzenle.
 */
import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { User, X as XIcon, Loader2, Save } from "lucide-react";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function authHeaders() {
  try {
    const sess = JSON.parse(localStorage.getItem("app_session") || "null");
    return sess?.token ? { Authorization: `Bearer ${sess.token}` } : {};
  } catch { return {}; }
}

const EMPTY = { name: "", phone: "", address: "", email: "", notes: "" };

export default function CustomerEditDialog({ open, customer, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const isEdit = !!customer?.id;

  useEffect(() => {
    if (open) {
      setForm(customer ? {
        name: customer.name || "",
        phone: customer.phone || "",
        address: customer.address || "",
        email: customer.email || "",
        notes: customer.notes || "",
      } : EMPTY);
    }
  }, [open, customer]);

  const handleSave = async () => {
    const name = (form.name || "").trim();
    if (!name) {
      toast.error("İsim zorunlu");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await axios.put(`${API}/customers/${customer.id}`, form, { headers: authHeaders() });
        toast.success("Müşteri güncellendi");
      } else {
        const res = await axios.post(`${API}/customers`, form, { headers: authHeaders() });
        toast.success(res.data._existed ? "Mevcut müşteri seçildi" : `${res.data.code} eklendi`);
      }
      onSaved?.();
    } catch (e) {
      toast.error("Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[85]"
      />
      <div className="fixed inset-0 z-[86] flex items-center justify-center p-3 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: "spring", damping: 24, stiffness: 240 }}
          className="w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl bg-gradient-to-b from-[#1a1410] to-[#0c0904] ring-1 ring-amber-500/30 pointer-events-auto"
          data-testid="customer-edit-dialog"
          role="dialog"
        >
          <div className="h-px bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />

          <div className="px-5 py-4 border-b border-amber-500/15 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 ring-1 ring-amber-500/40 flex items-center justify-center">
                <User className="h-4 w-4 text-amber-300" />
              </div>
              <div>
                <h3 className="text-sm font-heading font-black text-amber-50">{isEdit ? "Müşteri Düzenle" : "Yeni Müşteri"}</h3>
                {isEdit && <p className="text-[10px] font-mono text-amber-300/70">{customer.code}</p>}
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={onClose} className="h-8 w-8 border-amber-500/30 text-amber-200 hover:bg-amber-500/10">
              <XIcon className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="p-5 space-y-3">
            <div>
              <Label className="text-xs text-amber-300/80 uppercase tracking-wider">İsim *</Label>
              <Input
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                data-testid="customer-edit-name"
                placeholder="ör: ABC Reklam Ltd."
                className="mt-1 bg-surface/60 border-amber-500/20"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-amber-300/80 uppercase tracking-wider">Telefon</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  data-testid="customer-edit-phone"
                  placeholder="05XX XXX XX XX"
                  className="mt-1 bg-surface/60 border-amber-500/20 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs text-amber-300/80 uppercase tracking-wider">E-posta</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  data-testid="customer-edit-email"
                  placeholder="info@..."
                  className="mt-1 bg-surface/60 border-amber-500/20"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-amber-300/80 uppercase tracking-wider">Adres</Label>
              <Textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                data-testid="customer-edit-address"
                placeholder="Teslimat / fatura adresi"
                rows={2}
                className="mt-1 bg-surface/60 border-amber-500/20 resize-none"
              />
            </div>
            <div>
              <Label className="text-xs text-amber-300/80 uppercase tracking-wider">Notlar</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                data-testid="customer-edit-notes"
                placeholder="Özel not (ödeme şartı, tercihler vs.)"
                rows={2}
                className="mt-1 bg-surface/60 border-amber-500/20 resize-none"
              />
            </div>
          </div>

          <div className="px-5 py-3 border-t border-amber-500/15 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose} className="border-amber-500/30 text-amber-200">İptal</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              data-testid="customer-edit-save"
              className="bg-amber-500 hover:bg-amber-600 text-[#1a1410] font-bold"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              {isEdit ? "Kaydet" : "Ekle"}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
