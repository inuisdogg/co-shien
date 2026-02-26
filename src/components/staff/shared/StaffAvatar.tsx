/**
 * StaffAvatar - スタッフ写真アバターコンポーネント
 * プロフィール写真がある場合は写真を表示し、ない場合はイニシャルを表示
 */

'use client';

import React from 'react';

interface StaffAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  xs: { container: 'w-6 h-6', text: 'text-[9px]' },
  sm: { container: 'w-8 h-8', text: 'text-[10px]' },
  md: { container: 'w-10 h-10', text: 'text-sm' },
  lg: { container: 'w-12 h-12', text: 'text-lg' },
} as const;

const StaffAvatar: React.FC<StaffAvatarProps> = ({
  name,
  photoUrl,
  size = 'sm',
  className = '',
}) => {
  const sizeConfig = SIZE_MAP[size];
  const initial = name?.charAt(0) || '?';

  if (photoUrl) {
    return (
      <div
        className={`${sizeConfig.container} rounded-full overflow-hidden flex-shrink-0 ${className}`}
      >
        <img
          src={photoUrl}
          alt={name}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeConfig.container} rounded-full bg-gradient-to-br from-[#00c4cc] to-[#00b0b8] flex items-center justify-center flex-shrink-0 ${className}`}
    >
      <span className={`text-white font-bold ${sizeConfig.text}`}>
        {initial}
      </span>
    </div>
  );
};

export default StaffAvatar;
