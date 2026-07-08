import * as XLSX from 'xlsx';
import { Participant, Church, ChurchPaymentStatus, Group, GroupingGroup } from '../types';

// Helper to download worksheet
const triggerDownload = (wb: XLSX.WorkBook, fileName: string) => {
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const excelUtils = {
  /**
   * 일반 JSON 데이터를 엑셀로 내보내기
   */
  exportRawData(data: Record<string, any>[], fileName: string) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    triggerDownload(wb, fileName);
  },

  /**
   * 프리셋 1: 전체 등록자 명단
   */
  exportAllParticipants(participants: Participant[], churches: Church[], columns: string[], fileName: string) {
    const churchMap = new Map(churches.map(c => [c.id, c.name]));
    
    const formatted = participants.map(p => {
      const row: Record<string, any> = {};
      if (columns.includes('이름')) row['이름'] = p.name;
      if (columns.includes('참가 유형')) row['참가 유형'] = p.participant_type;
      if (columns.includes('성별')) row['성별'] = p.gender;
      if (columns.includes('부서/학년')) row['부서/학년'] = p.department || '-';
      if (columns.includes('출생년도')) row['출생년도'] = p.birth_year || '-';
      if (columns.includes('소속 교회')) row['소속 교회'] = churchMap.get(p.church_id) || '-';
      if (columns.includes('보호자 이름')) row['보호자 이름'] = p.guardian_name || '-';
      if (columns.includes('보호자 연락처')) row['보호자 연락처'] = p.guardian_phone || '-';
      if (columns.includes('티셔츠 사이즈')) row['티셔츠 사이즈'] = p.shirt_size;
      if (columns.includes('알레르기/건강상 주의사항')) row['알레르기/건강상 주의사항'] = p.health_note || '-';
      if (columns.includes('사진 촬영 동의 여부')) row['사진 촬영 동의 여부'] = p.photo_consent ? '동의' : '미동의';
      if (columns.includes('추가 동의 여부')) row['추가 동의 여부'] = p.custom_consent_agreed ? '동의' : '미동의';
      if (columns.includes('참석 일정')) row['참석 일정'] = p.attendance_schedule.join(', ');
      if (columns.includes('비고')) row['비고'] = p.memo || '-';
      return row;
    });

    this.exportRawData(formatted, fileName);
  },

  /**
   * 프리셋 4: 교회별 티셔츠 사이즈 요약
   */
  exportTshirtSummary(participants: Participant[], churches: Church[], sizes: string[], fileName: string) {
    const churchMap = new Map(churches.map(c => [c.id, c.name]));
    const summaryData: Record<string, any>[] = [];

    churches.forEach(church => {
      const churchParticipants = participants.filter(p => p.church_id === church.id);
      if (churchParticipants.length === 0) return;

      const row: Record<string, any> = { '교회명': church.name };
      let total = 0;

      sizes.forEach(size => {
        const count = churchParticipants.filter(p => p.shirt_size === size).length;
        row[size] = count;
        total += count;
      });

      row['합계'] = total;
      summaryData.push(row);
    });

    // 전체 합계 행 추가
    if (summaryData.length > 0) {
      const totalRow: Record<string, any> = { '교회명': '총합계' };
      let grandTotal = 0;
      sizes.forEach(size => {
        const count = participants.filter(p => p.shirt_size === size).length;
        totalRow[size] = count;
        grandTotal += count;
      });
      totalRow['합계'] = grandTotal;
      summaryData.push(totalRow);
    }

    this.exportRawData(summaryData, fileName);
  },

  /**
   * 프리셋 5: 교회별 티셔츠 사이즈 상세
   */
  exportTshirtDetails(participants: Participant[], churches: Church[], fileName: string) {
    const churchMap = new Map(churches.map(c => [c.id, c.name]));
    
    // 교회 기준으로 정렬
    const sorted = [...participants].sort((a, b) => {
      const cA = churchMap.get(a.church_id) || '';
      const cB = churchMap.get(b.church_id) || '';
      return cA.localeCompare(cB);
    });

    const formatted = sorted.map(p => ({
      '소속 교회': churchMap.get(p.church_id) || '-',
      '이름': p.name,
      '참가 유형': p.participant_type,
      '부서/학년': p.department || '-',
      '성별': p.gender,
      '티셔츠 사이즈': p.shirt_size
    }));

    this.exportRawData(formatted, fileName);
  },

  /**
   * 프리셋 9: 납부 상태 현황
   */
  exportPaymentStatus(
    churches: Church[], 
    paymentStatuses: ChurchPaymentStatus[], 
    participants: Participant[],
    fileName: string
  ) {
    const formatted = churches.map(church => {
      const statusRecord = paymentStatuses.find(s => s.church_id === church.id);
      const churchParticipants = participants.filter(p => p.church_id === church.id);
      
      return {
        '교회명': church.name,
        '총 등록 인원': churchParticipants.length,
        '총 납부 금액': statusRecord?.total_amount || 0,
        '납부 상태': statusRecord?.status || '미납',
        '확인 일시': statusRecord?.confirmed_at ? new Date(statusRecord.confirmed_at).toLocaleString() : '-',
        '메모': statusRecord?.memo || '-'
      };
    });

    this.exportRawData(formatted, fileName);
  },

  /**
   * 조별 명단 내보내기
   */
  exportGroupMembers(
    participants: Participant[],
    churches: Church[],
    groups: Group[],
    groupingGroups: GroupingGroup[],
    fileName: string
  ) {
    const churchMap = new Map(churches.map(c => [c.id, c.name]));
    const groupMap = new Map(groups.map(g => [g.id, g]));
    const ggMap = new Map(groupingGroups.map(gg => [gg.id, gg]));

    const formatted = participants
      .filter(p => p.assigned_group_id)
      .map(p => {
        const group = groupMap.get(p.assigned_group_id!);
        const gg = group ? ggMap.get(group.grouping_group_id) : null;
        
        return {
          '조편성 그룹': gg?.name || '-',
          '배정된 조': group?.name || '-',
          '이름': p.name,
          '참가 유형': p.participant_type,
          '성별': p.gender,
          '부서/학년': p.department || '-',
          '소속 교회': churchMap.get(p.church_id) || '-',
          '역할': p.role || '-'
        };
      })
      .sort((a, b) => {
        // 조별 정렬
        if (a['배정된 조'] !== b['배정된 조']) return a['배정된 조'].localeCompare(b['배정된 조']);
        return a['이름'].localeCompare(b['이름']);
      });

    this.exportRawData(formatted, fileName);
  }
};
