import { useEffect, useRef } from 'react';

const TelegramLoginWidget = ({ botName, onAuth, buttonSize = 'large', requestAccess = 'write' }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    // Add the callback to the window object so the Telegram script can find it
    window.TelegramLoginWidget = {
      dataOnauth: (user) => onAuth(user),
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', buttonSize);
    script.setAttribute('data-request-access', requestAccess);
    script.setAttribute('data-onauth', 'TelegramLoginWidget.dataOnauth(user)');
    script.async = true;

    if (containerRef.current) {
      containerRef.current.appendChild(script);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      delete window.TelegramLoginWidget;
    };
  }, [botName, onAuth, buttonSize, requestAccess]);

  return <div ref={containerRef} className="flex justify-center mt-4"></div>;
};

export default TelegramLoginWidget;
