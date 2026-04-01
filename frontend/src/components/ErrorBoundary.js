import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React crash:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleClearCacheAndReload = async () => {
    try {
      // Service Worker önbelleğini temizle
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      // Service Worker'ı kaldır
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }
    } catch (e) {
      console.error('Cache temizleme hatasi:', e);
    }
    window.location.reload(true);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">Bir hata olustu</h2>
            <p className="text-text-secondary mb-6">Sayfa beklenmedik bir hatayla karsilasti.</p>
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
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
