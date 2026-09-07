// 로컬파트@도메인.최상위도메인 형태를 확인하는 정규식.
// [^\s@]는 공백을 제외하므로 "abc @gmail.com"(로컬파트 뒤 공백),
// "abc@gmail. com"(도메인 쪽 공백) 같은 입력은 매칭에 실패합니다.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 이메일 형식이 유효한지 확인합니다. 앞뒤 공백은 trim 후 검사합니다. */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  return EMAIL_PATTERN.test(trimmed);
}
