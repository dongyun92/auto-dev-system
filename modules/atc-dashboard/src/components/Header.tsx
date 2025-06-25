import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWebSocket } from '../services/WebSocketProvider';

const Header: React.FC = () => {
  const { isConnected } = useWebSocket();
  const location = useLocation();

  return (
    <header className="bg-gray-900 border-b border-gray-700 px-4 py-3" style={{ height: '64px' }}>
      <div className="flex items-center justify-between h-full">
        <div className="flex items-center space-x-6">
          <h1 className="text-lg font-bold text-white">
            김포타워 RWSL 통합 대시보드
          </h1>
          <nav className="flex space-x-2">
            <Link
              to="/"
              className={`px-3 py-1 rounded text-sm font-medium ${
                location.pathname === '/' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              대시보드
            </Link>
            <Link
              to="/runway/14R-32L"
              className={`px-3 py-1 rounded text-sm font-medium ${
                location.pathname.startsWith('/runway') 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              활주로 상태
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;