export interface School {
  SCHUL_NM: string;
  ATPT_OFCDC_SC_NM: string;
  SCHUL_KND_SC_NM: string;
  SD_SCHUL_CODE: string;
  ORG_RDNMA: string; // 도로명 주소
  HMPG_ADRES: string; // 홈페이지 주소
  ORG_TELNO: string; // 전화번호
  FOND_YMD: string; // 설립일
}

const NEIS_KEY = "19f78fd07bfb4243a6333e7bf4641bfc";

export async function searchSchools(keyword: string): Promise<School[]> {
  if (keyword.length < 2) return [];
  
  // pSize=100을 추가하여 초등학교를 포함한 더 많은 결과를 가져옵니다.
  const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${NEIS_KEY}&Type=json&pSize=100&SCHUL_NM=${encodeURIComponent(keyword)}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.schoolInfo?.[1]?.row || [];
  } catch (error) {
    console.error("NEIS API Error:", error);
    return [];
  }
}
