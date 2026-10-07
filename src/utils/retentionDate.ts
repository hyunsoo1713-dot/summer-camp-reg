// 개인정보 자동 파기 날짜 계산 (서버 src/server/retention.ts 의 dataDeleteAt 과 같은 규칙)
// 행사 마지막 날 다음 날부터 30일 동안 남아 있고, 그 다음 날 0시(한국 시간)에 삭제됩니다.
export const DATA_KEEP_DAYS = 30;

const dayOf = (v?: string | null) => {
  const d = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? Date.parse(`${d}T00:00:00+09:00`) : NaN;
};

/** 자동 영구 삭제 시각. 신청 마감일이 더 늦게 적혀 있으면 그날 기준 */
export function dataDeleteDate(endDate?: string | null, registrationEndDate?: string | null): Date | null {
  const end = dayOf(endDate);
  if (Number.isNaN(end)) return null;
  const reg = dayOf(registrationEndDate);
  const base = Number.isNaN(reg) ? end : Math.max(end, reg);
  return new Date(base + (DATA_KEEP_DAYS + 1) * 86400000);
}

/** 한국 날짜로 "9월 14일" 형식 */
export function koreanMonthDay(date: Date | string): string {
  const t = typeof date === 'string' ? Date.parse(date) : date.getTime();
  const k = new Date(t + 9 * 3600000);
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일`;
}
