"use client";

import { useState, useMemo } from "react";
import { searchSchools, type School } from "@/lib/neis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Trophy, Globe, Loader2, MousePointer2, MapPin, Phone, Link as LinkIcon, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SchoolRankData {
  name: string;
  score: number;
}

export function SchoolClicker() {
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);
  
  const [myScore, setMyScore] = useState(0);
  const [rankings] = useState<SchoolRankData[]>([
    { name: "서울고등학교", score: 12504 },
    { name: "경기고등학교", score: 10832 },
    { name: "부산고등학교", score: 9421 },
    { name: "대구고등학교", score: 8765 },
    { name: "광주고등학교", score: 7210 },
  ]);

  const totalGlobalClicks = useMemo(() => {
    return rankings.reduce((acc, curr) => acc + curr.score, 0) + (selectedSchool ? myScore : 0);
  }, [rankings, myScore, selectedSchool]);

  const myRank = useMemo(() => {
    if (!selectedSchool) return "-";
    const sorted = [...rankings];
    const existingIdx = sorted.findIndex(r => r.name === selectedSchool.SCHUL_NM);
    if (existingIdx !== -1) {
      sorted[existingIdx].score += myScore;
    } else {
      sorted.push({ name: selectedSchool.SCHUL_NM, score: myScore });
    }
    sorted.sort((a, b) => b.score - a.score);
    const rank = sorted.findIndex(r => r.name === selectedSchool.SCHUL_NM) + 1;
    return rank;
  }, [rankings, myScore, selectedSchool]);

  const handleSearch = async (val: string) => {
    setSearchKeyword(val);
    if (val.length >= 2) {
      setIsSearching(true);
      const results = await searchSchools(val);
      setSearchResults(results);
      setIsSearching(false);
    } else {
      setSearchResults([]);
    }
  };

  const selectSchool = (school: School) => {
    setSelectedSchool(school);
    setMyScore(0);
    setOpen(false);
    setSearchKeyword("");
    setSearchResults([]);
  };

  const handleButtonClick = () => {
    if (!selectedSchool) return;
    setMyScore(prev => prev + 1);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return "-";
    return `${dateStr.substring(0, 4)}년 ${dateStr.substring(4, 6)}월 ${dateStr.substring(6, 8)}일`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pb-20">
      <div className="text-center space-y-2 py-8">
        <h1 className="text-5xl font-extrabold tracking-tighter text-white">
          🏫 SCHOOL CLICK
        </h1>
        <p className="text-muted-foreground text-lg">실제 학교 정보를 확인하고 클릭 경쟁에 참여하세요!</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full h-16 text-xl font-bold rounded-2xl bg-primary hover:bg-primary/90 shadow-lg transition-all active:scale-95">
            <Search className="mr-2 h-6 w-6" /> 우리 학교 검색하기
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md bg-card border-white/10 p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">학교 검색</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <Input
              placeholder="학교 이름을 입력하세요 (예: 경기고)"
              value={searchKeyword}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-12 bg-white/5 border-white/10 text-lg rounded-xl focus:ring-primary"
            />
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {isSearching ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((school, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectSchool(school)}
                      className="w-full text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 transition-all group"
                    >
                      <div className="font-bold text-lg group-hover:text-primary transition-colors">{school.SCHUL_NM}</div>
                      <div className="text-sm text-muted-foreground">{school.ATPT_OFCDC_SC_NM} | {school.SCHUL_KND_SC_NM}</div>
                    </button>
                  ))
                ) : searchKeyword.length >= 2 ? (
                  <div className="text-center p-8 text-muted-foreground">검색 결과가 없습니다.</div>
                ) : (
                  <div className="text-center p-8 text-muted-foreground">학교 이름을 2글자 이상 입력하세요.</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="glass-card border-none shadow-2xl overflow-hidden">
        <CardHeader className="border-b border-white/5">
          <CardTitle className="flex items-center gap-2 text-2xl font-bold">
            <Trophy className="text-yellow-500" /> 학교 랭킹 (데모)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-white/5">
            {rankings.map((school, idx) => {
              const isMine = selectedSchool?.SCHUL_NM === school.name;
              return (
                <div key={idx} className={`flex items-center justify-between p-4 px-6 ${isMine ? 'bg-primary/20' : ''}`}>
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold ${idx < 3 ? 'bg-yellow-500 text-black' : 'bg-white/10'}`}>
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-lg">{school.name}</span>
                  </div>
                  <div className="text-cyan font-bold tabular-nums">
                    {(school.score + (isMine ? myScore : 0)).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-none shadow-2xl">
        <CardContent className="p-8 space-y-8">
          <div className="text-center space-y-1">
            <h2 className="text-3xl font-black">{selectedSchool ? selectedSchool.SCHUL_NM : "학교를 선택하세요"}</h2>
            <p className="text-muted-foreground font-medium">현재 순위: {selectedSchool ? `전국 ${myRank}위` : "-"}</p>
          </div>

          <div className="flex flex-col items-center justify-center py-4">
            <div className="text-7xl font-black text-cyan drop-shadow-[0_0_20px_rgba(77,215,234,0.3)] mb-2">
              {myScore.toLocaleString()}
            </div>
            <div className="text-lg font-bold text-muted-foreground uppercase tracking-widest">Clicks</div>
          </div>

          <button
            onClick={handleButtonClick}
            disabled={!selectedSchool}
            className="w-full h-32 relative overflow-hidden bg-gradient-to-br from-primary to-blue-600 rounded-[30px] shadow-[0_10px_40px_rgba(37,99,235,0.4)] transition-all click-btn-active disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-active:opacity-100 transition-opacity" />
            <div className="flex items-center justify-center gap-4 text-white">
              <MousePointer2 className="h-10 w-10 animate-bounce" />
              <span className="text-4xl font-black tracking-widest">CLICK!</span>
            </div>
          </button>

          {selectedSchool && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
              <div className="bg-white/5 rounded-2xl p-5 space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm font-semibold">
                  <MapPin className="h-4 w-4" /> 주소
                </div>
                <div className="text-sm font-medium">{selectedSchool.ORG_RDNMA || "정보 없음"}</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-5 space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm font-semibold">
                  <Phone className="h-4 w-4" /> 전화번호
                </div>
                <div className="text-sm font-medium">{selectedSchool.ORG_TELNO || "정보 없음"}</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-5 space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm font-semibold">
                  <LinkIcon className="h-4 w-4" /> 홈페이지
                </div>
                <div className="text-sm font-medium truncate">
                  {selectedSchool.HMPG_ADRES ? (
                    <a href={selectedSchool.HMPG_ADRES.startsWith('http') ? selectedSchool.HMPG_ADRES : `http://${selectedSchool.HMPG_ADRES}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      {selectedSchool.HMPG_ADRES}
                    </a>
                  ) : "정보 없음"}
                </div>
              </div>
              <div className="bg-white/5 rounded-2xl p-5 space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm font-semibold">
                  <Calendar className="h-4 w-4" /> 설립일
                </div>
                <div className="text-sm font-medium">{formatDate(selectedSchool.FOND_YMD)}</div>
              </div>
              <div className="col-span-full bg-white/5 rounded-2xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground text-sm font-semibold">
                  <Globe className="h-4 w-4" /> 전역 총 클릭 합계
                </div>
                <div className="text-xl font-bold text-cyan">{totalGlobalClicks.toLocaleString()}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
