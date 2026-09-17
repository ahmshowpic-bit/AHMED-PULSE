import React from 'react';

interface VisitorIdentityProps {
  visitorId: string;
}

const VisitorIdentity: React.FC<VisitorIdentityProps> = () => {
  return null; // هذا السطر يمنع ظهور البانر في الواجهة
};

export default React.memo(VisitorIdentity);
