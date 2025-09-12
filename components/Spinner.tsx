import React from 'react';
import { Loader } from 'lucide-react';

export const Spinner: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => {
  return <Loader style={{ width: size, height: size }} className={`animate-spin text-primary ${className}`} />;
};