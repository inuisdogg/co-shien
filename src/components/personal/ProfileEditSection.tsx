/**
 * プロフィール編集セクション
 * キャリアページのインライン編集フォームを抽出したコンポーネント
 */

'use client';

import React from 'react';
import { Building2 } from 'lucide-react';

export interface Dependent {
  id: string;
  name: string;
  furigana: string;
  relationship: string;
  birthDate: string;
  gender: 'male' | 'female';
  occupation: string;
  annualIncome: string;
  notWorking: boolean;
  notWorkingReason: string;
  myNumber: string;
  separateAddress?: string;
}

export interface ProfileData {
  name: string;
  lastName: string;
  firstName: string;
  nameKana: string;
  lastNameKana: string;
  firstNameKana: string;
  email: string;
  birthDate: string;
  address: string;
  phone: string;
  gender: string;
  education: string;
  hasSpouse: boolean;
  spouseName: string;
  myNumber: string;
  basicPensionSymbol: string;
  basicPensionNumber: string;
  employmentInsuranceStatus: 'joined' | 'not_joined' | 'first_time';
  employmentInsuranceNumber: string;
  previousRetirementDate: string;
  previousName: string;
  socialInsuranceStatus: 'joined' | 'not_joined';
  hasDependents: boolean;
  dependentCount: number;
  dependents: Dependent[];
}

interface ProfileEditSectionProps {
  profileData: ProfileData;
  onProfileDataChange: (data: ProfileData) => void;
  onSave: () => void;
  onCancel: () => void;
}

const inputClass = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-personal/30 focus:border-personal';
const smallInputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-personal/30 focus:border-personal text-sm';

const ProfileEditSection: React.FC<ProfileEditSectionProps> = ({
  profileData,
  onProfileDataChange,
  onSave,
  onCancel,
}) => {
  const update = (partial: Partial<ProfileData>) => {
    onProfileDataChange({ ...profileData, ...partial });
  };

  const updateDependent = (index: number, field: string, value: any) => {
    const updated = [...profileData.dependents];
    (updated[index] as any)[field] = value;
    onProfileDataChange({ ...profileData, dependents: updated });
  };

  return (
    <div className="space-y-4">
      {/* 氏名 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">氏名 <span className="text-red-500">*</span></label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">姓</label>
            <input
              type="text"
              value={profileData.lastName}
              onChange={(e) => {
                const lastName = e.target.value;
                update({ lastName, name: `${lastName} ${profileData.firstName}`.trim() });
              }}
              placeholder="山田"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">名</label>
            <input
              type="text"
              value={profileData.firstName}
              onChange={(e) => {
                const firstName = e.target.value;
                update({ firstName, name: `${profileData.lastName} ${firstName}`.trim() });
              }}
              placeholder="太郎"
              className={inputClass}
              required
            />
          </div>
        </div>
      </div>

      {/* フリガナ */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">フリガナ</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">セイ</label>
            <input
              type="text"
              value={profileData.lastNameKana}
              onChange={(e) => {
                const lastNameKana = e.target.value;
                update({ lastNameKana, nameKana: `${lastNameKana} ${profileData.firstNameKana}`.trim() });
              }}
              placeholder="ヤマダ"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">メイ</label>
            <input
              type="text"
              value={profileData.firstNameKana}
              onChange={(e) => {
                const firstNameKana = e.target.value;
                update({ firstNameKana, nameKana: `${profileData.lastNameKana} ${firstNameKana}`.trim() });
              }}
              placeholder="タロウ"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* メールアドレス */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">メールアドレス（ログインID）</label>
        <input
          type="email"
          value={profileData.email}
          onChange={(e) => update({ email: e.target.value })}
          className={inputClass}
          placeholder="ログインIDとして使用されます"
        />
      </div>

      {/* 生年月日 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">生年月日</label>
        <input
          type="date"
          value={profileData.birthDate}
          onChange={(e) => update({ birthDate: e.target.value })}
          className={inputClass}
        />
      </div>

      {/* 住所 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">住所</label>
        <input
          type="text"
          value={profileData.address}
          onChange={(e) => update({ address: e.target.value })}
          className={inputClass}
        />
      </div>

      {/* 電話番号 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">電話番号</label>
        <input
          type="tel"
          value={profileData.phone}
          onChange={(e) => update({ phone: e.target.value })}
          className={inputClass}
        />
      </div>

      {/* 性別 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">性別</label>
        <select
          value={profileData.gender}
          onChange={(e) => update({ gender: e.target.value })}
          className={inputClass}
        >
          <option value="">選択してください</option>
          <option value="男性">男性</option>
          <option value="女性">女性</option>
          <option value="その他">その他</option>
        </select>
      </div>

      {/* マイナンバー */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">マイナンバー</label>
        <input
          type="text"
          value={profileData.myNumber}
          onChange={(e) => update({ myNumber: e.target.value })}
          placeholder="12桁のマイナンバー"
          maxLength={12}
          className={inputClass}
        />
      </div>

      {/* 配偶者 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">配偶者</label>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="hasSpouse"
                checked={profileData.hasSpouse}
                onChange={() => update({ hasSpouse: true, spouseName: profileData.spouseName || '' })}
                className="w-4 h-4 text-personal"
              />
              <span className="text-sm">有</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="hasSpouse"
                checked={!profileData.hasSpouse}
                onChange={() => update({ hasSpouse: false, spouseName: '' })}
                className="w-4 h-4 text-personal"
              />
              <span className="text-sm">無</span>
            </label>
          </div>
          {profileData.hasSpouse && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">配偶者氏名</label>
              <input
                type="text"
                value={profileData.spouseName}
                onChange={(e) => update({ spouseName: e.target.value })}
                className={inputClass}
              />
            </div>
          )}
        </div>
      </div>

      {/* 基礎年金番号 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">基礎年金番号</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-600 mb-1">記号（4桁）</label>
            <input
              type="text"
              value={profileData.basicPensionSymbol}
              onChange={(e) => update({ basicPensionSymbol: e.target.value })}
              maxLength={4}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">番号（6桁）</label>
            <input
              type="text"
              value={profileData.basicPensionNumber}
              onChange={(e) => update({ basicPensionNumber: e.target.value })}
              maxLength={6}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* 現在の所属事業所での契約内容 */}
      <div className="mt-6 pt-6 border-t border-gray-300">
        <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-personal" />
          現在の所属事業所での契約内容
        </h3>
      </div>

      {/* 雇用保険 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">雇用保険</label>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="employmentInsurance"
                value="joined"
                checked={profileData.employmentInsuranceStatus === 'joined'}
                onChange={(e) => update({ employmentInsuranceStatus: e.target.value as any })}
                className="w-4 h-4 text-personal"
              />
              <span className="text-sm">加入</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="employmentInsurance"
                value="not_joined"
                checked={profileData.employmentInsuranceStatus === 'not_joined'}
                onChange={(e) => update({ employmentInsuranceStatus: e.target.value as any })}
                className="w-4 h-4 text-personal"
              />
              <span className="text-sm">非加入</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="employmentInsurance"
                value="first_time"
                checked={profileData.employmentInsuranceStatus === 'first_time'}
                onChange={(e) => update({ employmentInsuranceStatus: e.target.value as any })}
                className="w-4 h-4 text-personal"
              />
              <span className="text-sm">初めて加入</span>
            </label>
          </div>
          {profileData.employmentInsuranceStatus === 'joined' && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">雇用保険番号（被保険者番号）</label>
              <input
                type="text"
                value={profileData.employmentInsuranceNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d-]/g, '');
                  update({ employmentInsuranceNumber: value });
                }}
                placeholder="例: 1234-567890-1"
                maxLength={13}
                className={inputClass}
              />
              <p className="text-xs text-gray-500 mt-1">4桁-6桁-1桁の形式で入力してください</p>
            </div>
          )}
          {profileData.employmentInsuranceStatus === 'first_time' && (
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">前職の名（旧姓の場合）</label>
                <input
                  type="text"
                  value={profileData.previousName}
                  onChange={(e) => update({ previousName: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">前職の退職日</label>
                <input
                  type="date"
                  value={profileData.previousRetirementDate}
                  onChange={(e) => update({ previousRetirementDate: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 社会保険 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">社会保険</label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="socialInsurance"
              value="joined"
              checked={profileData.socialInsuranceStatus === 'joined'}
              onChange={(e) => update({ socialInsuranceStatus: e.target.value as any })}
              className="w-4 h-4 text-personal"
            />
            <span className="text-sm">加入</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="socialInsurance"
              value="not_joined"
              checked={profileData.socialInsuranceStatus === 'not_joined'}
              onChange={(e) => update({ socialInsuranceStatus: e.target.value as any })}
              className="w-4 h-4 text-personal"
            />
            <span className="text-sm">非加入</span>
          </label>
        </div>
      </div>

      {/* 扶養家族 */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">扶養家族</label>
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="hasDependents"
                checked={profileData.hasDependents}
                onChange={() => update({ hasDependents: true })}
                className="w-4 h-4 text-personal"
              />
              <span className="text-sm">有</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="hasDependents"
                checked={!profileData.hasDependents}
                onChange={() => update({ hasDependents: false, dependents: [] })}
                className="w-4 h-4 text-personal"
              />
              <span className="text-sm">無</span>
            </label>
          </div>
          {profileData.hasDependents && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">人数</label>
                <input
                  type="number"
                  min="0"
                  value={profileData.dependentCount}
                  onChange={(e) => {
                    const count = parseInt(e.target.value) || 0;
                    const currentDependents = profileData.dependents;
                    const newDependents = Array.from({ length: count }, (_, i) =>
                      currentDependents[i] || {
                        id: Date.now().toString() + i,
                        name: '',
                        furigana: '',
                        relationship: '',
                        birthDate: '',
                        gender: 'male' as const,
                        occupation: '',
                        annualIncome: '',
                        notWorking: false,
                        notWorkingReason: '',
                        myNumber: '',
                      }
                    );
                    onProfileDataChange({ ...profileData, dependentCount: count, dependents: newDependents });
                  }}
                  className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-personal/30 focus:border-personal"
                />
                <span className="ml-2 text-sm text-gray-600">人</span>
              </div>
              {profileData.dependents.map((dependent, index) => (
                <div key={dependent.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
                  <h4 className="text-sm font-bold text-gray-700">扶養家族 {index + 1}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">続柄</label>
                      <input
                        type="text"
                        value={dependent.relationship}
                        onChange={(e) => updateDependent(index, 'relationship', e.target.value)}
                        placeholder="例：妻、子"
                        className={smallInputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">生年月日</label>
                      <input
                        type="date"
                        value={dependent.birthDate}
                        onChange={(e) => updateDependent(index, 'birthDate', e.target.value)}
                        className={smallInputClass}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">フリガナ</label>
                      <input
                        type="text"
                        value={dependent.furigana}
                        onChange={(e) => updateDependent(index, 'furigana', e.target.value)}
                        className={smallInputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">氏名</label>
                      <input
                        type="text"
                        value={dependent.name}
                        onChange={(e) => updateDependent(index, 'name', e.target.value)}
                        className={smallInputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">性別</label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`dependent-gender-${index}`}
                          checked={dependent.gender === 'male'}
                          onChange={() => updateDependent(index, 'gender', 'male')}
                          className="w-4 h-4 text-personal"
                        />
                        <span className="text-sm">男</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`dependent-gender-${index}`}
                          checked={dependent.gender === 'female'}
                          onChange={() => updateDependent(index, 'gender', 'female')}
                          className="w-4 h-4 text-personal"
                        />
                        <span className="text-sm">女</span>
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">職業</label>
                      <input
                        type="text"
                        value={dependent.occupation}
                        onChange={(e) => updateDependent(index, 'occupation', e.target.value)}
                        className={smallInputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">収入（年収）</label>
                      <input
                        type="text"
                        value={dependent.annualIncome}
                        onChange={(e) => updateDependent(index, 'annualIncome', e.target.value)}
                        placeholder="円"
                        className={smallInputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={dependent.notWorking}
                        onChange={(e) => updateDependent(index, 'notWorking', e.target.checked)}
                        className="w-4 h-4 text-personal"
                      />
                      <span className="text-xs text-gray-600">働いていない場合</span>
                    </label>
                    {dependent.notWorking && (
                      <select
                        value={dependent.notWorkingReason}
                        onChange={(e) => updateDependent(index, 'notWorkingReason', e.target.value)}
                        className={smallInputClass}
                      >
                        <option value="">選択してください</option>
                        <option value="preschooler">未就学児</option>
                        <option value="elementary">小学生</option>
                        <option value="junior_high">中学生</option>
                        <option value="high_school">高校生</option>
                        <option value="university">大学生</option>
                        <option value="other">その他</option>
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">マイナンバー</label>
                    <input
                      type="text"
                      value={dependent.myNumber}
                      onChange={(e) => updateDependent(index, 'myNumber', e.target.value.replace(/\D/g, '').slice(0, 12))}
                      maxLength={12}
                      placeholder="12桁"
                      className={smallInputClass}
                    />
                  </div>
                  {index > 0 && (
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">別居の場合は住所を明記</label>
                      <input
                        type="text"
                        value={dependent.separateAddress || ''}
                        onChange={(e) => updateDependent(index, 'separateAddress', e.target.value)}
                        className={smallInputClass}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ボタン */}
      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="px-4 py-2 bg-personal text-white rounded-lg hover:bg-personal-dark transition-colors font-bold"
        >
          保存
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-bold"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
};

export default ProfileEditSection;
