export interface School {
  SCHUL_NM: string;
  ATPT_OFCDC_SC_NM: string;
  SCHUL_KND_SC_NM: string;
  SD_SCHUL_CODE: string;
  ATPT_OFCDC_SC_CODE: string;
  ORG_RDNMA: string;
  HMPG_ADRES: string;
  ORG_TELNO: string;
  FOND_YMD: string;
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
  // 한국 시간 기준으로 날짜 생성
  const kstNow = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
  const year = kstNow.getUTCFullYear();
  const month = String(kstNow.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstNow.getUTCDate()).padStart(2, '0');
  const today = `${year}${month}${day}`;
  
  if (!atptCode || !schulCode) return "학교 코드 정보가 부족합니다.";

  const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${NEIS_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${atptCode}&SD_SCHUL_CODE=${schulCode}&MLSV_YMD=${today}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    
    // 데이터가 없는 경우 처리
    if (data.RESULT && (data.RESULT.CODE === "INFO-200" || data.RESULT.CODE === "INFO-100")) {
      return "오늘의 급식 정보가 없습니다.";
    }

    if (!data.mealServiceDietInfo) {
      return "오늘의 급식 정보가 없습니다.";
    }

    const row = data.mealServiceDietInfo[1].row[0];
    if (row && row.DDISH_NM) {
      // <br/> 태그를 줄바꿈으로 변경하고 특수기호 및 알러지 정보 정리
      return row.DDISH_NM
        .replace(/<br\/>/g, '\n')
        .replace(/\([0-9.]+\)/g, '')
        .replace(/\*/g, '')
        .trim();
    }
    return "급식 정보를 찾을 수 없습니다.";
  } catch (error) {
    console.error("Meal API Error:", error);
    return "급식 정보를 불러오는 중 오류가 발생했습니다.";
  }
}
