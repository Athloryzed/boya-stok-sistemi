import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Platform kontrolü
export const isNativePlatform = () => {
  return Capacitor.isNativePlatform();
};

// Android için native push notification kurulumu
export const initializePushNotifications = async (userId, userType) => {
  if (!isNativePlatform()) {
    console.log('Push notifications: Web platform, using Firebase Web SDK');
    return null;
  }

  try {
    // İzin kontrolü
    let permStatus = await PushNotifications.checkPermissions();
    console.log('Push permission status:', permStatus);

    if (permStatus.receive === 'prompt') {
      // İzin iste
      permStatus = await PushNotifications.requestPermissions();
      console.log('Push permission after request:', permStatus);
    }

    if (permStatus.receive !== 'granted') {
      console.log('Push notifications permission denied');
      return null;
    }

    // Push notifications'ı kaydet
    await PushNotifications.register();
    console.log('Push notifications registered');

    // Token alındığında
    PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration token:', token.value);
      
      // Token'ı backend'e gönder
      try {
        await fetch(`${API_URL}/api/notifications/register-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: token.value,
            user_type: userType,
            user_id: userId,
            platform: 'android'
          })
        });
        console.log('FCM token registered to backend');
      } catch (error) {
        console.error('Error registering token to backend:', error);
      }
    });

    // Kayıt hatası
    PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
    });

    // Bildirim alındığında (uygulama açıkken)
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received:', notification);
      // Burada toast gösterebilirsiniz
    });

    // Bildirime tıklandığında
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push notification action performed:', notification);
      // Burada ilgili sayfaya yönlendirme yapabilirsiniz
    });

    return true;
  } catch (error) {
    console.error('Push notification initialization error:', error);
    return null;
  }
};

// Token'ı backend'e kaydet (web için de kullanılabilir)
export const registerTokenToBackend = async (token, userId, userType, platform = 'web') => {
  try {
    const response = await fetch(`${API_URL}/api/notifications/register-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        user_type: userType,
        user_id: userId,
        platform
      })
    });
    return response.ok;
  } catch (error) {
    console.error('Error registering token:', error);
    return false;
  }
};
