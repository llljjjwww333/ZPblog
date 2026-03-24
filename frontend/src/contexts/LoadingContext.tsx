import React, { createContext, useContext, useState, ReactNode } from 'react';
import { LoadingModal } from '../components/LoadingModal';

interface LoadingContextType {
  setLoading: (isLoading: boolean, message?: string) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('加载中...');

  const setLoading = (isLoading: boolean, message?: string) => {
    setIsLoading(isLoading);
    if (message) {
      setLoadingMessage(message);
    }
  };

  return (
    <LoadingContext.Provider value={{ setLoading }}>
      {children}
      <LoadingModal isVisible={isLoading} message={loadingMessage} />
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading必须在LoadingProvider内部使用');
  }
  return context;
};
