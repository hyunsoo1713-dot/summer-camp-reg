import { redirect } from 'next/navigation';

// 예전 단일 지방회용 주소입니다. 보안을 위해 더 이상 사용하지 않으며, 첫 화면으로 보냅니다.
// 지방회별 화면은 /district/[지방회주소]/... 를 사용합니다.
export default function LegacyRedirect() {
  redirect('/');
}
