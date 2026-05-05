import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React crash:', error, errorInfo);
    this.setState({ errorInfo });
    // Hata raporunu localStorage'a kaydet (kullanıcı destek icin paylasabilsin)
    try {
      const report = {
        message: error?.message || String(error),
        stack: error?.stack || "",
        componentStack: errorInfo?.componentStack || "",
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem('last_crash_report', JSON.stringify(report));
    } catch (e) {
      // ignore
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleClearCacheAndReload = async () => {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }
      // localStorage'taki "auth_token" hariç bazı verileri de temizle
      localStorage.removeItem('management_session');
      localStorage.removeItem('plan_session');
      localStorage.removeItem('operator_session');
      localStorage.removeItem('depo_session');
      localStorage.removeItem('bobin_session');
    } catch (e) {
      console.error('Cache temizleme hatasi:', e);
    }
    window.location.reload(true);
  };

  handleCopyError = async () => {
    const { error, errorInfo } = this.state;
    const report = `Buse Kagit - Hata Raporu
========================
Mesaj: ${error?.message || String(error)}
URL: ${window.location.href}
Zaman: ${new Date().toLocaleString('tr-TR')}
Cihaz: ${navigator.userAgent}

Stack:
${error?.stack || "(yok)"}

Component:
${errorInfo?.componentStack || "(yok)"}
========================`;
    try {
      await navigator.clipboard.writeText(report);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    } catch (e) {
      // Fallback: textarea + execCommand
      try {
        const ta = document.createElement('textarea');
        ta.value = report;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2500);
      } catch {
        alert('Kopyalama basarisiz. Lutfen ekran goruntusu alin.');
      }
    }
  };

  render() {
    if (this.state.hasError) {
      const { error, copied } = this.state;
      const errorMessage = error?.message || String(error) || "Bilinmeyen hata";
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="text-center max-w-md w-full">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">Bir hata olustu</h2>
            <p className="text-text-secondary mb-4">Sayfa beklenmedik bir hatayla karsilasti.</p>

            {/* Hata mesaji - kullanici ne oldugunu gorebilsin ve paylasabilsin */}
            <div className="bg-surface border border-border rounded-lg p-3 mb-4 text-left">
              <p className="text-[10px] font-mono uppercase tracking-widest text-text-secondary mb-1">Hata Mesaji</p>
              <p className="text-xs text-red-400 font-mono break-words" data-testid="error-message-text">
                {errorMessage}
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={this.handleReload}
                data-testid="error-reload-btn"
                className="w-full px-6 py-3 bg-primary text-black font-semibold rounded-lg hover:bg-primary/90 transition-colors"
              >
                Sayfayi Yenile
              </button>
              <button
                onClick={this.handleClearCacheAndReload}
                data-testid="error-clear-cache-btn"
                className="w-full px-6 py-3 bg-surface border border-border text-text-primary font-semibold rounded-lg hover:bg-surface-highlight transition-colors text-sm"
              >
                Onbellegi Temizle ve Yeniden Yukle
              </button>
              <button
                onClick={this.handleCopyError}
                data-testid="error-copy-btn"
                className="w-full px-6 py-3 bg-transparent border border-border text-text-secondary font-medium rounded-lg hover:bg-surface transition-colors text-sm"
              >
                {copied ? "Kopyalandi! Destek ekibine yapistir" : "Hata Detayini Kopyala (destek icin)"}
              </button>
            </div>

            <p className="text-xs text-text-muted mt-4">
              Sorun devam ediyorsa hata detayini kopyalayip yazilim destegine iletmeniz cozumu hizlandirir.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
