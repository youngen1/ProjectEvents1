import React from 'react';
import { Link } from 'react-router-dom';

const Logo = ({ className = '', to = '/' }) => {
  return (
    <Link to={to} className={`-m-1.5 p-1.5 ${className}`}>
      <span className="font-bold font-dancingScript text-2xl">
        Event Circle
      </span>
    </Link>
  );
};

export default Logo; 