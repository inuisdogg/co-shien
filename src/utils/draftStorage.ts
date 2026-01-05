/**
 * 下書き保存機能
 * ローカルストレージを使用して下書きデータを管理
 */

import { ChildFormData } from '@/types';

const DRAFT_STORAGE_KEY = 'kidos_child_drafts';

export const saveDraft = (draft: ChildFormData): void => {
  try {
    const drafts = getDrafts();
    const existingIndex = drafts.findIndex((d) => d.name === draft.name);
    
    if (existingIndex >= 0) {
      drafts[existingIndex] = draft;
    } else {
      drafts.push(draft);
    }
    
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.error('Failed to save draft:', error);
  }
};

export const getDrafts = (): ChildFormData[] => {
  try {
    const data = localStorage.getItem(DRAFT_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get drafts:', error);
    return [];
  }
};

export const deleteDraft = (childName: string): void => {
  try {
    const drafts = getDrafts();
    const filtered = drafts.filter((d) => d.name !== childName);
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete draft:', error);
  }
};

export const loadDraft = (childName: string): ChildFormData | null => {
  try {
    const drafts = getDrafts();
    return drafts.find((d) => d.name === childName) || null;
  } catch (error) {
    console.error('Failed to load draft:', error);
    return null;
  }
};




