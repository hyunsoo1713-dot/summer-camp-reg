import { Participant, SameGroupRequest, GroupingGroup, Group } from '../types';

export interface GroupingResult {
  assignments: Record<string, string[]>; // groupId -> participantIds[]
  unassigned: string[]; // participantIds[]
}

export function runAutoGrouping(
  config: GroupingGroup,
  allParticipants: Participant[],
  allRequests: SameGroupRequest[],
  targetGroups: Group[]
): GroupingResult {
  const groupIds = targetGroups.map(g => g.id);
  const numGroups = groupIds.length;

  if (numGroups === 0) {
    return {
      assignments: {},
      unassigned: allParticipants.map(p => p.id)
    };
  }

  // 1. 대상 참가자 필터링
  // - 학생: department가 included_departments에 포함된 참가자
  let targetStudents = allParticipants.filter(p => 
    p.participant_type === '학생' && 
    p.department && 
    config.included_departments.includes(p.department)
  );

  // - 교사/봉사자: assign_teachers 옵션이 켜져 있는 경우, 부서명이 매칭되거나 혹은 전체 교사를 대상으로 배정
  // (실제 데이터에서 교사는 department 필드가 없거나 role로 관리되므로, 이 조편성 그룹에 속한 학생들의 부서와 매칭되거나,
  // 혹은 단순히 학생 수 대비 교사 배정을 위해 교회별 담당 교사를 분산 배정합니다.)
  let targetTeachers = config.assign_teachers 
    ? allParticipants.filter(p => 
        (p.participant_type === '교사' || p.participant_type === '봉사자') &&
        (!p.department || config.included_departments.includes(p.department))
      )
    : [];

  const assignments: Record<string, string[]> = {};
  groupIds.forEach(gid => {
    assignments[gid] = [];
  });

  const unassigned: string[] = [];

  // 2. 같은 조 요청 그룹화 (학생 대상)
  // 서로 같은 조로 묶여야 하는 학생들의 Map 구축
  const parentMap = new Map<string, string>();
  
  const find = (id: string): string => {
    if (!parentMap.has(id)) {
      parentMap.set(id, id);
      return id;
    }
    let root = id;
    while (root !== parentMap.get(root)) {
      root = parentMap.get(root)!;
    }
    // 경로 압축
    let curr = id;
    while (curr !== root) {
      const next = parentMap.get(curr)!;
      parentMap.set(curr, root);
      curr = next;
    }
    return root;
  };

  const union = (id1: string, id2: string) => {
    const root1 = find(id1);
    const root2 = find(id2);
    if (root1 !== root2) {
      parentMap.set(root1, root2);
    }
  };

  if (config.consider_same_group_request) {
    // 같은 교회 내에서만 같은 조 요청이 유효하다고 가정
    allRequests.forEach(req => {
      // 요청자와 대상자가 같은 교회 소속이고 둘 다 이번 조편성 대상 학생인 경우 묶음
      const student1 = targetStudents.find(s => s.id === req.participant_id);
      const student2 = targetStudents.find(s => s.name === req.requested_participant_name && s.church_id === req.church_id);
      
      if (student1 && student2) {
        union(student1.id, student2.id);
      }
    });
  }

  // 연결 컴포넌트별로 학생들 그룹화
  const studentGroups = new Map<string, Participant[]>();
  targetStudents.forEach(student => {
    const rootId = find(student.id);
    if (!studentGroups.has(rootId)) {
      studentGroups.set(rootId, []);
    }
    studentGroups.get(rootId)!.push(student);
  });

  // 그룹 크기순으로 정렬된 학생 유닛 리스트 생성
  const studentUnits = Array.from(studentGroups.values()).sort((a, b) => b.length - a.length);

  // 3. 교사/봉사자 먼저 배정 (조별 최소 1명 배정 목표)
  // 교회 분산 및 성별 균형을 고려하여 라운드 로빈 배정
  const sortedTeachers = [...targetTeachers].sort((a, b) => {
    // 교회 ID 순서로 정렬하여 분산이 잘 되도록 유도
    if (a.church_id !== b.church_id) return a.church_id.localeCompare(b.church_id);
    return a.gender.localeCompare(b.gender);
  });

  sortedTeachers.forEach((teacher, idx) => {
    const targetGroupId = groupIds[idx % numGroups];
    assignments[targetGroupId].push(teacher.id);
  });

  // 4. 학생 유닛 배정 (그리디 + 가중치 점수 방식)
  studentUnits.forEach(unit => {
    let bestGroupId = groupIds[0];
    let minScore = Infinity;

    // 각 조의 현재 상태를 기반으로 이 유닛을 배정할 때의 적합도 점수 계산
    groupIds.forEach(gid => {
      const currentMemberIds = assignments[gid];
      const currentMembers = allParticipants.filter(p => currentMemberIds.includes(p.id));

      // 가중치 계수
      const W_SIZE = 100;      // 조 크기 균형 가중치 (매우 중요)
      const W_CHURCH = 40;     // 교회 분산 가중치 (한 조에 같은 교회가 너무 많으면 감점)
      const W_GENDER = 30;     // 성별 성비 가중치
      const W_ATTENDANCE = 10; // 참석 일정 일치 가중치

      // 1) 조 인원수 점수 (인원이 적을수록 좋음)
      const sizeScore = currentMembers.length * W_SIZE;

      // 2) 교회 분산 점수 (이 유닛에 속한 교회와 겹치는 교회가 조에 많을수록 감점)
      let churchConflictCount = 0;
      unit.forEach(u => {
        const sameChurchCount = currentMembers.filter(m => m.church_id === u.church_id).length;
        churchConflictCount += sameChurchCount;
      });
      const churchScore = config.distribute_church ? (churchConflictCount * W_CHURCH) : 0;

      // 3) 성별 균형 점수 (유닛의 성비가 조의 기존 성비를 심하게 해치는지 검사)
      let genderScore = 0;
      if (config.balance_gender) {
        const boys = currentMembers.filter(m => m.gender === '남').length;
        const girls = currentMembers.filter(m => m.gender === '여').length;
        const unitBoys = unit.filter(u => u.gender === '남').length;
        const unitGirls = unit.filter(u => u.gender === '여').length;
        
        // 배정 후 성비 격차 계산
        const diffAfter = Math.abs((boys + unitBoys) - (girls + unitGirls));
        genderScore = diffAfter * W_GENDER;
      }

      // 4) 참석 일정 일치 점수 (조 멤버들 간의 일정 겹침 정도)
      let attendanceScore = 0;
      if (config.consider_attendance && unit.length > 0) {
        unit.forEach(u => {
          currentMembers.forEach(m => {
            // 일정이 다르면 감점
            const commonDays = u.attendance_schedule.filter(d => m.attendance_schedule.includes(d)).length;
            const maxDays = Math.max(u.attendance_schedule.length, m.attendance_schedule.length);
            attendanceScore += (maxDays - commonDays) * W_ATTENDANCE;
          });
        });
      }

      const totalScore = sizeScore + churchScore + genderScore + attendanceScore;

      if (totalScore < minScore) {
        minScore = totalScore;
        bestGroupId = gid;
      }
    });

    // 최적의 조에 유닛 전체 배정
    unit.forEach(u => {
      assignments[bestGroupId].push(u.id);
    });
  });

  return {
    assignments,
    unassigned
  };
}
