import React from "react";
import { X, Share, Plus, BellRing, AlertCircle, CheckCircle2 } from "lucide-react";

/**
 * iPhone kullanıcılarına PWA kurulum + bildirim aktive etme adım adım kılavuzu.
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   status: "needs_install" | "version_old" | "ready"
 *     - needs_install: kullanıcı Safari'de, PWA olarak yüklemeli
 *     - version_old: iOS 16.4 altı (Web Push desteklenmiyor)
 *     - ready: PWA olarak yüklü, sadece bildirim izni gerek (bilgilendirme)
 */
const IOSInstallGuide = ({ open, onClose, status = "needs_install" }) => {
  if (!open) return null;

  const isOldVersion = status === "version_old";

  return (
    <div
      data-testid="ios-install-guide"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden border border-amber-200 dark:border-amber-500/30 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 px-5 py-4 border-b border-amber-200 dark:border-amber-500/30 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="bg-amber-400/20 p-2 rounded-lg">
              <BellRing className="h-5 w-5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">
                iPhone&apos;da Bildirim Açma
              </h2>
              <p className="text-xs text-gray-600 dark:text-zinc-400 mt-0.5">
                {isOldVersion
                  ? "iOS sürümünüz çok eski"
                  : "3 hızlı adım — 1 dakikadan kısa"}
              </p>
            </div>
          </div>
          <button
            data-testid="ios-guide-close"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-amber-200/50 dark:hover:bg-amber-500/20 transition-colors"
            aria-label="Kapat"
          >
            <X className="h-5 w-5 text-gray-700 dark:text-zinc-300" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isOldVersion ? (
            <div className="text-center py-6 space-y-3">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-100 dark:bg-red-500/20">
                <AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-gray-800 dark:text-zinc-200 font-semibold">
                iPhone&apos;unuzun iOS sürümü güncel değil.
              </p>
              <p className="text-sm text-gray-600 dark:text-zinc-400">
                iPhone bildirimleri için en az <b>iOS 16.4</b> gerekiyor. Lütfen{" "}
                <b>Ayarlar → Genel → Yazılım Güncellemesi</b> bölümünden güncelleyin.
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-500 italic">
                iPhone 8 ve sonraki tüm modeller iOS 16+ destekler.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-700 dark:text-zinc-300">
                Apple, iPhone&apos;da bildirim için uygulamayı <b>ana ekrana eklemenizi</b> ister.
                Bu çok kısa, bir kere yapılır:
              </p>

              <div className="space-y-3">
                {/* Adım 1 */}
                <div className="flex gap-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3 border border-amber-200 dark:border-amber-500/30">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-400 text-black font-black text-sm flex items-center justify-center">
                    1
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white text-sm">
                      Safari&apos;de Paylaş simgesine basın
                    </p>
                    <p className="text-xs text-gray-600 dark:text-zinc-400 mt-1">
                      Ekranın altındaki{" "}
                      <Share className="inline h-3.5 w-3.5 mx-0.5 text-blue-500" />{" "}
                      simgesi — kutu içinde yukarı ok.
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-500 mt-1 italic">
                      iPad&apos;de bu simge ekranın sağ üstündedir.
                    </p>
                  </div>
                </div>

                {/* Adım 2 */}
                <div className="flex gap-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3 border border-amber-200 dark:border-amber-500/30">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-400 text-black font-black text-sm flex items-center justify-center">
                    2
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white text-sm">
                      &quot;Ana Ekrana Ekle&quot; seçeneğine basın
                    </p>
                    <p className="text-xs text-gray-600 dark:text-zinc-400 mt-1">
                      Açılan listede aşağı kaydırın → <Plus className="inline h-3.5 w-3.5 mx-0.5" />{" "}
                      <b>Ana Ekrana Ekle</b>, sonra sağ üstte <b>Ekle</b>.
                    </p>
                  </div>
                </div>

                {/* Adım 3 */}
                <div className="flex gap-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl p-3 border border-emerald-200 dark:border-emerald-500/30">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-white font-black text-sm flex items-center justify-center">
                    3
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white text-sm">
                      Yeni simgeye ana ekrandan dokunun
                    </p>
                    <p className="text-xs text-gray-600 dark:text-zinc-400 mt-1">
                      Buse Kağıt simgesini açın — bu sefer{" "}
                      <BellRing className="inline h-3.5 w-3.5 mx-0.5 text-amber-600" />{" "}
                      <b>Bildirim Aç</b> butonuna tıklayın ve <b>İzin Ver</b>&apos;e basın.
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1.5 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Hepsi bu kadar! Bildirim almaya başlayacaksınız.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3 text-xs text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-500/30">
                <p className="font-semibold mb-1">ℹ️ Neden bu adımlar?</p>
                <p className="leading-relaxed">
                  Apple, gizlilik için iPhone&apos;da web bildirimine yalnızca &quot;yüklü
                  uygulama&quot; gibi davrananlara izin veriyor. Ana ekrana ekleme bu izni açar.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-zinc-900/80 px-5 py-3 border-t border-gray-200 dark:border-zinc-700">
          <button
            data-testid="ios-guide-ok"
            onClick={onClose}
            className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg py-2.5 transition-colors"
          >
            Anladım
          </button>
        </div>
      </div>
    </div>
  );
};

export default IOSInstallGuide;
