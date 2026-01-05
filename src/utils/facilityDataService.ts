/**
 * 施設データサービス
 * 現在はローカル状態管理を使用していますが、将来的にSupabaseなどのDBから取得できるように抽象化
 */

import {
  Child,
  Staff,
  ScheduleItem,
  BookingRequest,
  FacilitySettings,
} from '@/types';

// データ取得インターフェース（将来的にSupabase実装に置き換え可能）
export interface FacilityDataService {
  // 児童データ
  getChildren: (facilityId: string) => Promise<Child[]>;
  addChild: (facilityId: string, child: Omit<Child, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => Promise<Child>;
  updateChild: (child: Child) => Promise<Child>;
  deleteChild: (childId: string) => Promise<void>;

  // スタッフデータ
  getStaff: (facilityId: string) => Promise<Staff[]>;
  addStaff: (facilityId: string, staff: Omit<Staff, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => Promise<Staff>;
  updateStaff: (staff: Staff) => Promise<Staff>;
  deleteStaff: (staffId: string) => Promise<void>;

  // スケジュールデータ
  getSchedules: (facilityId: string) => Promise<ScheduleItem[]>;
  addSchedule: (facilityId: string, schedule: Omit<ScheduleItem, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => Promise<ScheduleItem>;
  deleteSchedule: (scheduleId: number) => Promise<void>;

  // 予約リクエスト
  getRequests: (facilityId: string) => Promise<BookingRequest[]>;
  addRequest: (facilityId: string, request: Omit<BookingRequest, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>) => Promise<BookingRequest>;
  updateRequest: (request: BookingRequest) => Promise<BookingRequest>;
  deleteRequest: (requestId: number) => Promise<void>;

  // 施設情報設定
  getFacilitySettings: (facilityId: string) => Promise<FacilitySettings | null>;
  updateFacilitySettings: (facilityId: string, settings: Partial<FacilitySettings>) => Promise<FacilitySettings>;
}

/**
 * ローカル実装（現在の実装）
 * 将来的にSupabase実装に置き換える場合は、このファイルを修正するか、
 * 新しいファイル（例: supabaseFacilityDataService.ts）を作成して実装を切り替える
 */
class LocalFacilityDataService implements FacilityDataService {
  // 現在はuseFacilityDataフック内で管理されているため、
  // この実装は将来のSupabase移行時の参考として残しておく
  // 実際の実装はuseFacilityDataフック内で行われている

  async getChildren(facilityId: string): Promise<Child[]> {
    // 現在はuseFacilityDataフック内で管理
    // 将来的には: const { data } = await supabase.from('children').select('*').eq('facilityId', facilityId);
    throw new Error('Not implemented: Use useFacilityData hook');
  }

  async addChild(facilityId: string, child: Omit<Child, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>): Promise<Child> {
    // 将来的には: const { data } = await supabase.from('children').insert({...child, facilityId}).select().single();
    throw new Error('Not implemented: Use useFacilityData hook');
  }

  async updateChild(child: Child): Promise<Child> {
    // 将来的には: const { data } = await supabase.from('children').update(child).eq('id', child.id).select().single();
    throw new Error('Not implemented: Use useFacilityData hook');
  }

  async deleteChild(childId: string): Promise<void> {
    // 将来的には: await supabase.from('children').delete().eq('id', childId);
    throw new Error('Not implemented: Use useFacilityData hook');
  }

  async getStaff(facilityId: string): Promise<Staff[]> {
    throw new Error('Not implemented: Use useFacilityData hook');
  }

  async addStaff(facilityId: string, staff: Omit<Staff, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>): Promise<Staff> {
    throw new Error('Not implemented: Use useFacilityData hook');
  }

  async updateStaff(staff: Staff): Promise<Staff> {
    throw new Error('Not implemented: Use useFacilityData hook');
  }

  async deleteStaff(staffId: string): Promise<void> {
    throw new Error('Not implemented: Use useFacilityData hook');
  }

  async getSchedules(facilityId: string): Promise<ScheduleItem[]> {
    throw new Error('Not implemented: Use useFacilityData hook');
  }

  async addSchedule(facilityId: string, schedule: Omit<ScheduleItem, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>): Promise<ScheduleItem> {
    throw new Error('Not implemented: Use useFacilityData hook');
  }

  async deleteSchedule(scheduleId: number): Promise<void> {
    throw new Error('Not implemented: Use useFacilityData hook');
  }

  async getRequests(facilityId: string): Promise<BookingRequest[]> {
    throw new Error('Not implemented: Use useFacilityData hook');
  }

  async addRequest(facilityId: string, request: Omit<BookingRequest, 'id' | 'facilityId' | 'createdAt' | 'updatedAt'>): Promise<BookingRequest> {
    throw new Error('Not implemented: Use useFacilityData hook');
  }

  async updateRequest(request: BookingRequest): Promise<BookingRequest> {
    throw new Error('Not implemented: Use useFacilityData hook');
  }

  async deleteRequest(requestId: number): Promise<void> {
    throw new Error('Not implemented: Use useFacilityData hook');
  }

  async getFacilitySettings(facilityId: string): Promise<FacilitySettings | null> {
    // 将来的には:
    // const { data } = await supabase
    //   .from('facility_settings')
    //   .select('*')
    //   .eq('facilityId', facilityId)
    //   .single();
    // return data;
    throw new Error('Not implemented: Use useFacilityData hook');
  }

  async updateFacilitySettings(facilityId: string, settings: Partial<FacilitySettings>): Promise<FacilitySettings> {
    // 将来的には:
    // const { data } = await supabase
    //   .from('facility_settings')
    //   .upsert({ ...settings, facilityId, updatedAt: new Date().toISOString() })
    //   .eq('facilityId', facilityId)
    //   .select()
    //   .single();
    // return data;
    throw new Error('Not implemented: Use useFacilityData hook');
  }
}

// 現在はローカル実装を使用
// 将来的にSupabaseに移行する場合は、この変数を変更するか、
// 環境変数などで切り替えられるようにする
export const facilityDataService: FacilityDataService = new LocalFacilityDataService();

/**
 * Supabase実装例（コメント）
 * 
 * import { createClient } from '@supabase/supabase-js';
 * 
 * const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
 * 
 * class SupabaseFacilityDataService implements FacilityDataService {
 *   async getFacilitySettings(facilityId: string): Promise<FacilitySettings | null> {
 *     const { data, error } = await supabase
 *       .from('facility_settings')
 *       .select('*')
 *       .eq('facilityId', facilityId)
 *       .single();
 *     
 *     if (error) throw error;
 *     return data;
 *   }
 * 
 *   async updateFacilitySettings(facilityId: string, settings: Partial<FacilitySettings>): Promise<FacilitySettings> {
 *     const { data, error } = await supabase
 *       .from('facility_settings')
 *       .upsert({
 *         ...settings,
 *         facilityId,
 *         updatedAt: new Date().toISOString(),
 *       })
 *       .eq('facilityId', facilityId)
 *       .select()
 *       .single();
 *     
 *     if (error) throw error;
 *     return data;
 *   }
 * 
 *   // 他のメソッドも同様に実装...
 * }
 * 
 * export const facilityDataService: FacilityDataService = new SupabaseFacilityDataService();
 */




