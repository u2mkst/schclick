export interface School {
  SCHUL_NM: string;
  ATPT_OFCDC_SC_NM: string;
  SCHUL_KND_SC_NM: string;
  SD_SCHUL_CODE: string;
}

const NEIS_KEY = "19f78fd07bfb4243a6333e7bf4641bfc";

export async function searchSchools(keyword: string): Promise<School[]> {
  if (keyword.length < 2) return [];
  
  const url = `https://open.neis.go.kr/hub/schoolInfo?KEY=${NEIS_KEY}&Type=json&SCHUL_NM=${encodeURIComponent(keyword)}`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.schoolInfo?.[1]?.row || [];
  } catch (error) {
    console.error("NEIS API Error:", error);
    return [];
  }
}
