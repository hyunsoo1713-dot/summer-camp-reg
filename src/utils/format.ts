export const formatPhone = (value: string): string => {
  if (!value) return '';
  // 숫자만 남김
  const num = value.replace(/[^\d]/g, '');
  const len = num.length;

  if (num.startsWith('02')) {
    // 서울 지역번호 (02) 대응
    if (len < 3) return num;
    if (len < 6) return `${num.slice(0, 2)}-${num.slice(2)}`;
    if (len < 10) return `${num.slice(0, 2)}-${num.slice(2, 5)}-${num.slice(5)}`;
    return `${num.slice(0, 2)}-${num.slice(2, 6)}-${num.slice(6, 10)}`;
  } else {
    // 일반 핸드폰(010) 및 기타 지역번호 대응
    if (len < 4) return num;
    if (len < 7) return `${num.slice(0, 3)}-${num.slice(3)}`;
    if (len < 11) return `${num.slice(0, 3)}-${num.slice(3, 6)}-${num.slice(6)}`;
    return `${num.slice(0, 3)}-${num.slice(3, 7)}-${num.slice(7, 11)}`;
  }
};
