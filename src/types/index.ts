export interface District {
  id: string;
  name: string;
  slug: string;
  manager_name: string;
  phone: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_church_name?: string;
  created_at: string;
}

export interface Event {
  id: string;
  district_id?: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  registration_start_date: string;
  registration_end_date: string;
  edit_deadline: string;
  is_active: boolean;
  notice_image_url?: string;
  location?: string;
  created_at: string;
  updated_at: string;
}

export interface Church {
  id: string;
  district_id?: string;
  event_id: string;
  name: string;
  memo?: string;
  created_at: string;
}

export interface ChurchManager {
  id: string;
  district_id?: string;
  church_id: string;
  name: string;
  phone: string;
  login_id: string;
  password_hash: string;
  status: 'pending' | 'approved' | 'rejected';
  memo?: string;
  is_admin?: boolean;
  is_manager?: boolean;
  requested_church_name?: string;
  created_at: string;
}

export interface Participant {
  id: string;
  district_id?: string;
  event_id: string;
  church_id: string;
  participant_type: '학생' | '교사' | '봉사자';
  name: string;
  gender: '남' | '여';
  department?: string;
  birth_year?: string;
  guardian_name?: string;
  guardian_phone?: string;
  personal_phone?: string;
  role?: string;
  shirt_size: string;
  health_note?: string;
  photo_consent: boolean;
  attendance_schedule: string[];
  edit_password_hash: string;
  memo?: string;
  assigned_group_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SameGroupRequest {
  id: string;
  district_id?: string;
  event_id: string;
  church_id: string;
  participant_id: string;
  participant_name: string;
  requested_participant_name: string;
  reason?: string;
  requested_by: string;
  status: '확인 필요' | '반영됨' | '미반영';
  created_at: string;
}

export interface GroupingGroup {
  id: string;
  district_id?: string;
  event_id: string;
  name: string;
  included_departments: string[];
  group_count: number;
  target_group_size: number;
  balance_gender: boolean;
  distribute_church: boolean;
  consider_same_group_request: boolean;
  consider_attendance: boolean;
  assign_teachers: boolean;
  created_at: string;
}

export interface Group {
  id: string;
  district_id?: string;
  event_id: string;
  grouping_group_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface GroupMember {
  id: string;
  district_id?: string;
  event_id: string;
  group_id: string;
  participant_id: string;
  role_in_group?: '교사' | '봉사자' | '학생';
  created_at: string;
}

export interface PaymentSettings {
  id: string;
  district_id?: string;
  event_id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  memo?: string;
  created_at: string;
  updated_at: string;
}

export interface ChurchFeeOverride {
  id: string;
  district_id?: string;
  event_id: string;
  church_id: string;
  participant_type: '학생' | '교사' | '봉사자';
  fee: number;
  created_at: string;
}

export interface ChurchPaymentStatus {
  id: string;
  district_id?: string;
  event_id: string;
  church_id: string;
  total_amount: number;
  status: '미납' | '확인 필요' | '납부완료';
  memo?: string;
  confirmed_at?: string;
  updated_at: string;
}

export interface PlatformConfig {
  id: string; // 'config' 고정
  support_bank_name: string;
  support_account_number: string;
  support_account_holder: string;
  support_intro_description: string;
  platform_intro_title: string;
  platform_intro_description: string;
  super_admin_password?: string;
  updated_at: string;
}
