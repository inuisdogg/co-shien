'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ChatView from './ChatView';

/**
 * Business-side wrapper for ChatView.
 * Reads facility/user info from AuthContext and passes to the underlying ChatView.
 */
const BusinessChatView: React.FC = () => {
  const { facility, user } = useAuth();

  const facilityId = facility?.id || '';
  const facilityName = facility?.name || '施設';
  const currentUserId = user?.id || '';
  const currentUserName = user?.name || 'スタッフ';

  return (
    <div className="h-[calc(100vh-140px)]">
      <ChatView
        facilityId={facilityId}
        facilityName={facilityName}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        currentUserType="staff"
      />
    </div>
  );
};

export default BusinessChatView;
