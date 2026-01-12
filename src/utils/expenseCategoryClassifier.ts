/**
 * 経費カテゴリ自動分類ロジック
 */

import { ExpenseCategory, CategoryClassification } from '@/types/expense';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_CATEGORY_IDS } from '@/constants/expenseCategories';

/**
 * 説明文からカテゴリを自動推定する
 * @param description 経費の説明・用途
 * @param customCategories 施設独自のカテゴリ（オプション）
 * @returns カテゴリID、名前、信頼度
 */
export const classifyExpense = (
  description: string,
  customCategories?: ExpenseCategory[]
): CategoryClassification => {
  if (!description || description.trim() === '') {
    return {
      categoryId: DEFAULT_CATEGORY_IDS.OTHER,
      categoryName: 'その他',
      confidence: 0,
    };
  }

  const normalizedDesc = description.toLowerCase();
  let bestMatch: CategoryClassification = {
    categoryId: DEFAULT_CATEGORY_IDS.OTHER,
    categoryName: 'その他',
    confidence: 0,
  };

  // カスタムカテゴリを先にチェック（施設独自のカテゴリを優先）
  if (customCategories) {
    for (const category of customCategories) {
      if (!category.isActive) continue;

      const matchCount = category.keywords.filter(keyword =>
        normalizedDesc.includes(keyword.toLowerCase())
      ).length;

      if (matchCount > 0) {
        const confidence = Math.min(matchCount / 3, 1); // 3つ以上マッチで100%
        if (confidence > bestMatch.confidence) {
          bestMatch = {
            categoryId: category.id,
            categoryName: category.name,
            confidence,
          };
        }
      }
    }
  }

  // デフォルトカテゴリをチェック
  for (const category of DEFAULT_EXPENSE_CATEGORIES) {
    if (category.id === DEFAULT_CATEGORY_IDS.OTHER) continue; // 「その他」はスキップ

    const matchCount = category.keywords.filter(keyword =>
      normalizedDesc.includes(keyword.toLowerCase())
    ).length;

    if (matchCount > 0) {
      const confidence = Math.min(matchCount / 2, 1); // 2つ以上マッチで100%
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          categoryId: category.id,
          categoryName: category.name,
          confidence,
        };
      }
    }
  }

  return bestMatch;
};

/**
 * 金額と説明から複数のカテゴリ候補を提案
 * @param description 経費の説明
 * @param amount 金額（参考用）
 * @param customCategories 施設独自のカテゴリ
 * @returns カテゴリ候補リスト（信頼度順）
 */
export const suggestCategories = (
  description: string,
  amount?: number,
  customCategories?: ExpenseCategory[]
): CategoryClassification[] => {
  const suggestions: CategoryClassification[] = [];
  const normalizedDesc = description?.toLowerCase() || '';

  // カスタムカテゴリをチェック
  if (customCategories) {
    for (const category of customCategories) {
      if (!category.isActive) continue;

      const matchCount = category.keywords.filter(keyword =>
        normalizedDesc.includes(keyword.toLowerCase())
      ).length;

      if (matchCount > 0) {
        suggestions.push({
          categoryId: category.id,
          categoryName: category.name,
          confidence: Math.min(matchCount / 3, 1),
        });
      }
    }
  }

  // デフォルトカテゴリをチェック
  for (const category of DEFAULT_EXPENSE_CATEGORIES) {
    if (category.id === DEFAULT_CATEGORY_IDS.OTHER) continue;

    const matchCount = category.keywords.filter(keyword =>
      normalizedDesc.includes(keyword.toLowerCase())
    ).length;

    if (matchCount > 0) {
      // 既存の候補と重複チェック
      const existing = suggestions.find(s => s.categoryId === category.id);
      if (!existing) {
        suggestions.push({
          categoryId: category.id,
          categoryName: category.name,
          confidence: Math.min(matchCount / 2, 1),
        });
      }
    }
  }

  // 信頼度順にソート
  suggestions.sort((a, b) => b.confidence - a.confidence);

  // 「その他」を末尾に追加（候補がない場合のフォールバック）
  if (suggestions.length === 0 || suggestions[suggestions.length - 1].categoryId !== DEFAULT_CATEGORY_IDS.OTHER) {
    suggestions.push({
      categoryId: DEFAULT_CATEGORY_IDS.OTHER,
      categoryName: 'その他',
      confidence: 0,
    });
  }

  return suggestions.slice(0, 5); // 最大5件
};

/**
 * 金額から妥当なカテゴリを推定（補助的な判断）
 * @param amount 金額
 * @returns 推定されるカテゴリのヒント
 */
export const getAmountBasedHint = (amount: number): string | null => {
  if (amount >= 100000) {
    return '高額のため、修繕費・研修費・設備費の可能性があります';
  }
  if (amount >= 10000 && amount < 50000) {
    return '消耗品費・研修費の可能性があります';
  }
  if (amount >= 1000 && amount < 5000) {
    return '交通費・食費の可能性があります';
  }
  if (amount < 1000) {
    return '少額のため、消耗品費・食費の可能性があります';
  }
  return null;
};
