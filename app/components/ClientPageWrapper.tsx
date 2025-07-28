'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';

interface ClientPageWrapperProps {
  children: React.ReactNode;
}

const ClientPageWrapper: React.FC<ClientPageWrapperProps> = ({ children }) => {
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  return (
    <>
      {/* Sidebar Component - Comment this section to disable */}
      {/* <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} /> */}
      
      {/* Main Content */}
      <div>
        {children}
      </div>
    </>
  );
};

export default ClientPageWrapper;