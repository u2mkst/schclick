export interface School {
  SCHUL_NM: string;
  ATPT_OFCDC_SC_NM: string;
  SCHUL_KND_SC_NM: string;
  SD_SCHUL_CODE: string;
  ATPT_OFCDC_SC_CODE: string; // 교육청 코드 추가
  ORG_RDNMA: string; // 도로명 주소
  HMPG_ADRES: string; // 홈페이지 주소
  ORG_TELNO: string; // 전화번호
  FOND_YMD: string; // 설립일
}

export interface MealInfo {
  DDISH_NM: string; // 식단명
  CAL_INFO: string; // 칼로리
}

const NEIS_KEY = "19f78fd07bfb4243a6333e7bf4641bfc";

export async function searchSchools(keyword: string): Promise<School[]> {
  if (keyword.length < 2) return [];
  
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

export async function getSchoolMeal(atptCode: string, schulCode: string): Promise<string> {
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${NEIS_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${atptCode}&SD_SCHUL_CODE=${schulCode}&MLSV_YMD=${today}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const row = data.mealServiceDietInfo?.[1]?.row?.[0];
    if (row && row.DDISH_NM) {
      // <br/> 태그를 줄바꿈으로 변경하고 특수기호 및 알러지 정보 정리
      return row.DDISH_NM.replace(/<br\/>/g, '\n').replace(/\([0-9.]+\)/g, '').trim();
    }
    return "오늘의 급식 정보가 없습니다.";
  } catch (error) {
    console.error("Meal API Error:", error);
    return "급식 정보를 불러오지 못했습니다.";
  }
}
