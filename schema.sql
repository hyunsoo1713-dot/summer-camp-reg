-- 여름행사 등록 데이터베이스 스키마 (Supabase PostgreSQL용)

-- 1. 행사 테이블 (events)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  registration_start_date DATE NOT NULL,
  registration_end_date DATE NOT NULL,
  edit_deadline DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 참여 교회 테이블 (churches)
CREATE TABLE churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  memo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. 교회 담당자 테이블 (church_managers)
CREATE TABLE church_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES churches(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  login_id VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending'::character varying CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. 등록 참가자 테이블 (participants)
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
  participant_type VARCHAR(20) CHECK (participant_type IN ('학생', '교사', '봉사자')),
  name VARCHAR(100) NOT NULL,
  gender VARCHAR(10) CHECK (gender IN ('남', '여')),
  department VARCHAR(100),
  birth_year VARCHAR(20),
  guardian_name VARCHAR(100),
  guardian_phone VARCHAR(50),
  personal_phone VARCHAR(50),
  role VARCHAR(100),
  shirt_size VARCHAR(20) NOT NULL,
  health_note TEXT,
  photo_consent BOOLEAN DEFAULT true,
  attendance_schedule TEXT[] NOT NULL, -- 날짜 스트링 배열
  edit_password_hash VARCHAR(255) NOT NULL,
  memo TEXT,
  assigned_group_id UUID, -- 조 ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. 같은 조 편성 요청 테이블 (same_group_requests)
CREATE TABLE same_group_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  participant_name VARCHAR(100) NOT NULL,
  requested_participant_name VARCHAR(100) NOT NULL,
  reason TEXT,
  requested_by VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT '확인 필요'::character varying CHECK (status IN ('확인 필요', '반영됨', '미반영')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. 조편성 대분류 그룹 테이블 (grouping_groups)
CREATE TABLE grouping_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  included_departments TEXT[] NOT NULL,
  group_count INTEGER DEFAULT 3,
  target_group_size INTEGER DEFAULT 5,
  balance_gender BOOLEAN DEFAULT true,
  distribute_church BOOLEAN DEFAULT true,
  consider_same_group_request BOOLEAN DEFAULT true,
  consider_attendance BOOLEAN DEFAULT true,
  assign_teachers BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. 소속 실제 조 테이블 (groups)
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  grouping_group_id UUID REFERENCES grouping_groups(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. 본부 수납 계좌 설정 테이블 (payment_settings)
CREATE TABLE payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  bank_name VARCHAR(100) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  account_holder VARCHAR(100) NOT NULL,
  memo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. 교회별 참가비 예외 테이블 (church_fee_overrides)
CREATE TABLE church_fee_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
  participant_type VARCHAR(20) CHECK (participant_type IN ('학생', '교사', '봉사자')),
  fee INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. 교회별 총액 및 납부 상태 테이블 (church_payment_statuses)
CREATE TABLE church_payment_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
  total_amount INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT '미납'::character varying CHECK (status IN ('미납', '확인 필요', '납부완료')),
  memo TEXT,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 관계형 데이터 제약을 위한 participants에 조 매핑 외래키 설정
ALTER TABLE participants ADD CONSTRAINT fk_assigned_group FOREIGN KEY (assigned_group_id) REFERENCES groups(id) ON DELETE SET NULL;
