import React from 'react';

interface LoadingModalProps {
  isVisible: boolean;
  message?: string;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({ isVisible, message = '加载中...' }) => {
  if (!isVisible) return null;

  return (
    <div className="loading-modal-overlay">
      <div className="loading-modal-content">
        <div className="loading-spinner"></div>
        <div className="loading-message">{message}</div>
      </div>
    </div>
  );
};
