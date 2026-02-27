/**
 * キャッシュフロー管理フック
 * cashflow_entries / cashflow_balances テーブルの取得・CRUD操作
 * P&L（損益計算書）・キャッシュフロー計算書の生成
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { CashflowEntry, CashflowBalance, PLStatement } from '@/types';

// DB row → CashflowEntry
function mapRow(row: Record<string, unknown>): CashflowEntry {
  return {
    id: row.id as string,
    facilityId: row.facility_id as string,
    yearMonth: row.year_month as string,
    category: row.category as 'income' | 'expense',
    subcategory: row.subcategory as string,
    itemName: row.item_name as string,
    amount: (row.amount as number) || 0,
    sortOrder: (row.sort_order as number) || 0,
    notes: (row.notes as string) || undefined,
    isTemplateItem: row.is_template_item as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// CashflowEntry → DB row for upsert
function toDbRow(entry: Partial<CashflowEntry> & { facilityId: string; yearMonth: string }) {
  const row: Record<string, unknown> = {};
  if (entry.id) row.id = entry.id;
  row.facility_id = entry.facilityId;
  row.year_month = entry.yearMonth;
  if (entry.category !== undefined) row.category = entry.category;
  if (entry.subcategory !== undefined) row.subcategory = entry.subcategory;
  if (entry.itemName !== undefined) row.item_name = entry.itemName;
  if (entry.amount !== undefined) row.amount = entry.amount;
  if (entry.sortOrder !== undefined) row.sort_order = entry.sortOrder;
  if (entry.notes !== undefined) row.notes = entry.notes || null;
  if (entry.isTemplateItem !== undefined) row.is_template_item = entry.isTemplateItem;
  return row;
}

// Default template items for a new month
const DEFAULT_INCOME_ITEMS: Array<{ itemName: string; subcategory: string; sortOrder: number }> = [
  { itemName: '介護給付費収入', subcategory: 'benefits', sortOrder: 1 },
  { itemName: '利用者負担金', subcategory: 'copay', sortOrder: 2 },
  { itemName: '加算収入', subcategory: 'additions', sortOrder: 3 },
  { itemName: '補助金・助成金', subcategory: 'subsidy', sortOrder: 4 },
  { itemName: 'その他収入', subcategory: 'other', sortOrder: 5 },
];

const DEFAULT_EXPENSE_ITEMS: Array<{ itemName: string; subcategory: string; sortOrder: number }> = [
  // 人件費
  { itemName: '給与・賞与', subcategory: 'personnel', sortOrder: 10 },
  { itemName: '法定福利費', subcategory: 'personnel', sortOrder: 11 },
  { itemName: '福利厚生費', subcategory: 'personnel', sortOrder: 12 },
  { itemName: '通勤手当', subcategory: 'personnel', sortOrder: 13 },
  // 事業費
  { itemName: '給食費', subcategory: 'operations', sortOrder: 20 },
  { itemName: '教材費', subcategory: 'operations', sortOrder: 21 },
  { itemName: '水道光熱費', subcategory: 'operations', sortOrder: 22 },
  { itemName: '賃借料', subcategory: 'operations', sortOrder: 23 },
  { itemName: '保険料', subcategory: 'operations', sortOrder: 24 },
  { itemName: '車両関連費', subcategory: 'operations', sortOrder: 25 },
  // 事務費
  { itemName: '通信費', subcategory: 'admin', sortOrder: 30 },
  { itemName: '消耗品費', subcategory: 'admin', sortOrder: 31 },
  { itemName: '修繕費', subcategory: 'admin', sortOrder: 32 },
  { itemName: '業務委託費', subcategory: 'admin', sortOrder: 33 },
  { itemName: '減価償却費', subcategory: 'admin', sortOrder: 34 },
  // その他
  { itemName: '借入金返済', subcategory: 'other_expense', sortOrder: 40 },
  { itemName: '設備投資', subcategory: 'other_expense', sortOrder: 41 },
  { itemName: 'その他支出', subcategory: 'other_expense', sortOrder: 42 },
];

export interface CashflowStatement {
  operating: number;
  investing: number;
  financing: number;
  netCashflow: number;
  closingBalance: number;
}

export function useCashflowManagement() {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [entries, setEntries] = useState<CashflowEntry[]>([]);
  const [balance, setBalance] = useState<CashflowBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch all entries for a given month
  const fetchEntries = useCallback(async (fId: string, yearMonth: string): Promise<CashflowEntry[]> => {
    if (!fId || !yearMonth) return [];
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cashflow_entries')
        .select('*')
        .eq('facility_id', fId)
        .eq('year_month', yearMonth)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error fetching cashflow entries:', error);
        return [];
      }
      const mapped = (data || []).map(mapRow);
      setEntries(mapped);
      return mapped;
    } finally {
      setLoading(false);
    }
  }, []);

  // Save (upsert) a single entry
  const saveEntry = useCallback(async (entry: CashflowEntry): Promise<CashflowEntry | null> => {
    setSaving(true);
    try {
      const row = toDbRow(entry);
      const { data, error } = await supabase
        .from('cashflow_entries')
        .upsert(row, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.error('Error saving cashflow entry:', error);
        return null;
      }
      const saved = mapRow(data);
      setEntries(prev => {
        const idx = prev.findIndex(e => e.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved].sort((a, b) => a.sortOrder - b.sortOrder);
      });
      return saved;
    } finally {
      setSaving(false);
    }
  }, []);

  // Bulk upsert entries (wizard save)
  const saveAllEntries = useCallback(async (entriesToSave: CashflowEntry[]): Promise<boolean> => {
    if (entriesToSave.length === 0) return true;
    setSaving(true);
    try {
      const rows = entriesToSave.map(e => toDbRow(e));
      const { error } = await supabase
        .from('cashflow_entries')
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        console.error('Error bulk saving cashflow entries:', error);
        return false;
      }
      // Refresh entries after bulk save
      const fId = entriesToSave[0].facilityId;
      const ym = entriesToSave[0].yearMonth;
      await fetchEntries(fId, ym);
      return true;
    } finally {
      setSaving(false);
    }
  }, [fetchEntries]);

  // Delete a single entry
  const deleteEntry = useCallback(async (id: string): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('cashflow_entries')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting cashflow entry:', error);
        return false;
      }
      setEntries(prev => prev.filter(e => e.id !== id));
      return true;
    } finally {
      setSaving(false);
    }
  }, []);

  // Fetch balance for a month
  const fetchBalance = useCallback(async (fId: string, yearMonth: string): Promise<CashflowBalance | null> => {
    if (!fId || !yearMonth) return null;
    try {
      const { data, error } = await supabase
        .from('cashflow_balances')
        .select('*')
        .eq('facility_id', fId)
        .eq('year_month', yearMonth)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching cashflow balance:', error);
        return null;
      }
      const bal: CashflowBalance | null = data
        ? {
            id: data.id as string,
            facilityId: data.facility_id as string,
            yearMonth: data.year_month as string,
            openingBalance: (data.opening_balance as number) || 0,
          }
        : null;
      setBalance(bal);
      return bal;
    } catch {
      return null;
    }
  }, []);

  // Save opening balance for a month
  const saveBalance = useCallback(async (fId: string, yearMonth: string, openingBalance: number): Promise<boolean> => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('cashflow_balances')
        .upsert(
          { facility_id: fId, year_month: yearMonth, opening_balance: openingBalance },
          { onConflict: 'facility_id,year_month' }
        )
        .select()
        .single();

      if (error) {
        console.error('Error saving cashflow balance:', error);
        return false;
      }
      if (data) {
        setBalance({
          id: data.id as string,
          facilityId: data.facility_id as string,
          yearMonth: data.year_month as string,
          openingBalance: (data.opening_balance as number) || 0,
        });
      }
      return true;
    } finally {
      setSaving(false);
    }
  }, []);

  // Initialize a month with default template items (only if no entries exist)
  const initializeMonth = useCallback(async (fId: string, yearMonth: string): Promise<CashflowEntry[]> => {
    if (!fId || !yearMonth) return [];

    // Check if entries already exist
    const { data: existing, error: checkError } = await supabase
      .from('cashflow_entries')
      .select('id')
      .eq('facility_id', fId)
      .eq('year_month', yearMonth)
      .limit(1);

    if (checkError) {
      console.error('Error checking existing entries:', checkError);
      return [];
    }

    if (existing && existing.length > 0) {
      // Already has entries, fetch them
      return fetchEntries(fId, yearMonth);
    }

    // Create default items
    const rows: Record<string, unknown>[] = [];

    for (const item of DEFAULT_INCOME_ITEMS) {
      rows.push({
        facility_id: fId,
        year_month: yearMonth,
        category: 'income',
        subcategory: item.subcategory,
        item_name: item.itemName,
        amount: 0,
        sort_order: item.sortOrder,
        is_template_item: true,
      });
    }

    for (const item of DEFAULT_EXPENSE_ITEMS) {
      rows.push({
        facility_id: fId,
        year_month: yearMonth,
        category: 'expense',
        subcategory: item.subcategory,
        item_name: item.itemName,
        amount: 0,
        sort_order: item.sortOrder,
        is_template_item: true,
      });
    }

    const { error } = await supabase
      .from('cashflow_entries')
      .insert(rows);

    if (error) {
      console.error('Error initializing month:', error);
      return [];
    }

    return fetchEntries(fId, yearMonth);
  }, [fetchEntries]);

  // Copy entries from previous month
  const copyFromPreviousMonth = useCallback(async (fId: string, yearMonth: string): Promise<CashflowEntry[]> => {
    if (!fId || !yearMonth) return [];

    // Calculate previous month
    const [y, m] = yearMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1); // month is 0-indexed
    const prevYM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    // Fetch previous month entries
    const { data: prevData, error: prevError } = await supabase
      .from('cashflow_entries')
      .select('*')
      .eq('facility_id', fId)
      .eq('year_month', prevYM)
      .order('sort_order', { ascending: true });

    if (prevError || !prevData || prevData.length === 0) {
      console.error('No previous month data found');
      return [];
    }

    // Delete current month entries first
    await supabase
      .from('cashflow_entries')
      .delete()
      .eq('facility_id', fId)
      .eq('year_month', yearMonth);

    // Copy entries with new month
    const rows = prevData.map((row: Record<string, unknown>) => ({
      facility_id: fId,
      year_month: yearMonth,
      category: row.category,
      subcategory: row.subcategory,
      item_name: row.item_name,
      amount: row.amount,
      sort_order: row.sort_order,
      notes: row.notes,
      is_template_item: row.is_template_item,
    }));

    const { error } = await supabase
      .from('cashflow_entries')
      .insert(rows);

    if (error) {
      console.error('Error copying from previous month:', error);
      return [];
    }

    return fetchEntries(fId, yearMonth);
  }, [fetchEntries]);

  // Generate P&L statement from entries
  const generatePL = useCallback((monthEntries: CashflowEntry[], yearMonth: string): PLStatement => {
    const findAmount = (cat: string, sub: string, name: string): number => {
      const entry = monthEntries.find(
        e => e.category === cat && e.subcategory === sub && e.itemName === name
      );
      return entry?.amount || 0;
    };

    const sumBySubcategory = (cat: string, sub: string): number => {
      return monthEntries
        .filter(e => e.category === cat && e.subcategory === sub)
        .reduce((sum, e) => sum + e.amount, 0);
    };

    // Income
    const benefits = findAmount('income', 'benefits', '介護給付費収入');
    const copay = findAmount('income', 'copay', '利用者負担金');
    const additions = findAmount('income', 'additions', '加算収入');
    const subsidy = findAmount('income', 'subsidy', '補助金・助成金');
    const otherIncome = sumBySubcategory('income', 'other');
    const totalIncome = benefits + copay + additions + subsidy + otherIncome;

    // Personnel
    const salary = findAmount('expense', 'personnel', '給与・賞与');
    const socialInsurance = findAmount('expense', 'personnel', '法定福利費');
    const welfare = findAmount('expense', 'personnel', '福利厚生費');
    const commuting = findAmount('expense', 'personnel', '通勤手当');
    const personnelOther = sumBySubcategory('expense', 'personnel') - salary - socialInsurance - welfare - commuting;
    const personnelTotal = salary + socialInsurance + welfare + commuting + Math.max(0, personnelOther);

    // Operations
    const meals = findAmount('expense', 'operations', '給食費');
    const materials = findAmount('expense', 'operations', '教材費');
    const utilities = findAmount('expense', 'operations', '水道光熱費');
    const rent = findAmount('expense', 'operations', '賃借料');
    const insurance = findAmount('expense', 'operations', '保険料');
    const vehicle = findAmount('expense', 'operations', '車両関連費');
    const opsOther = sumBySubcategory('expense', 'operations') - meals - materials - utilities - rent - insurance - vehicle;
    const operationsTotal = meals + materials + utilities + rent + insurance + vehicle + Math.max(0, opsOther);

    // Admin
    const communication = findAmount('expense', 'admin', '通信費');
    const supplies = findAmount('expense', 'admin', '消耗品費');
    const repairs = findAmount('expense', 'admin', '修繕費');
    const outsourcing = findAmount('expense', 'admin', '業務委託費');
    const depreciation = findAmount('expense', 'admin', '減価償却費');
    const adminOther = sumBySubcategory('expense', 'admin') - communication - supplies - repairs - outsourcing - depreciation;
    const adminTotal = communication + supplies + repairs + outsourcing + depreciation + Math.max(0, adminOther);

    // Other expenses
    const loanRepayment = findAmount('expense', 'other_expense', '借入金返済');
    const capex = findAmount('expense', 'other_expense', '設備投資');
    const misc = sumBySubcategory('expense', 'other_expense') - loanRepayment - capex;
    const otherTotal = loanRepayment + capex + Math.max(0, misc);

    const totalExpenses = personnelTotal + operationsTotal + adminTotal + otherTotal;

    return {
      yearMonth,
      income: {
        benefits,
        copay,
        additions,
        subsidy,
        other: otherIncome,
        total: totalIncome,
      },
      expenses: {
        personnel: { salary, socialInsurance, welfare, commuting, total: personnelTotal },
        operations: { meals, materials, utilities, rent, insurance, vehicle, total: operationsTotal },
        admin: { communication, supplies, repairs, outsourcing, depreciation, total: adminTotal },
        other: { loanRepayment, capex, misc: Math.max(0, misc), total: otherTotal },
        total: totalExpenses,
      },
      netIncome: totalIncome - totalExpenses,
    };
  }, []);

  // Generate cash flow statement from P&L and opening balance
  const generateCashflow = useCallback((pl: PLStatement, openingBalance: number): CashflowStatement => {
    // Operating: income - personnel - operations - admin
    const operating = pl.income.total - pl.expenses.personnel.total - pl.expenses.operations.total - pl.expenses.admin.total;

    // Investing: capex (negative)
    const investing = -pl.expenses.other.capex;

    // Financing: loan repayment (negative)
    const financing = -pl.expenses.other.loanRepayment;

    // Other misc expenses reduce operating
    const netCashflow = operating + investing + financing - pl.expenses.other.misc;

    const closingBalance = openingBalance + netCashflow;

    return {
      operating,
      investing,
      financing,
      netCashflow,
      closingBalance,
    };
  }, []);

  return {
    entries,
    balance,
    loading,
    saving,
    facilityId,
    fetchEntries,
    saveEntry,
    saveAllEntries,
    deleteEntry,
    fetchBalance,
    saveBalance,
    initializeMonth,
    copyFromPreviousMonth,
    generatePL,
    generateCashflow,
  };
}
