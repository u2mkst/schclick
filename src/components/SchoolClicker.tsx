"use client";

import { useState, useEffect, useMemo } from "react";
import { searchSchools, type School } from "@/lib/neis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Trophy, Users, Globe, Award, Loader2, MousePointer2 } from "lucide-react";
import { SloganGenerator } from "./SloganGenerator";
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
  
  // Real-time scores and rankings state
  const [myScore, setMyScore] = useState(0);
  const [rankings, setRankings] = useState<SchoolRankData[]>([
    { name: "서울고등학교", score: 12504 },
    { name: "경기고등학교", score: 10832 },
    { name: "부산고등학교", score: 9421 },
    { name: "대구고등학교", score: 8765 },
    { name: "광주고등학교", score: 7210 },
    { name: "인천고등학교", score: 6543 },
    { name: "대전고등학교", score: 5432 },
    { name: "울산고등학교", score: 4321 },
    { name: "세종고등학교", score: 3210 },
    { name: "제주고등학교", score: 2100 },
  ]);

  // Load random stats for selected school
  const stats = useMemo(() => {
    if (!selectedSchool) return null;
    return {
      students: Math.floor(Math.random() * 800) + 200,
      online: Math.floor(Math.random() * 50) + 1,
    };
  }, [selectedSchool]);

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

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pb-20">
      <div className="text-center space-y-2 py-8">
        <h1 className="text-5xl font-extrabold tracking-tighter text-white">
          🏫 SCHOOL CLICK
        </h1>
        <p className="text-muted-foreground text-lg">우리 학교를 전국 1위로 만드세요!</p>
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
            <Trophy className="text-yellow-500" /> 전국 학교 랭킹 TOP 10
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

          {selectedSchool && <SloganGenerator schoolName={selectedSchool.SCHUL_NM} />}

          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="bg-white/5 rounded-2xl p-5 text-center space-y-1">
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm font-semibold">
                <Users className="h-4 w-4" /> 학생 수
              </div>
              <div className="text-2xl font-bold">{stats?.students || "-"}</div>
            </div>
            <div className="bg-white/5 rounded-2xl p-5 text-center space-y-1">
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm font-semibold">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> 동접자
              </div>
              <div className="text-2xl font-bold">{stats?.online || "-"}</div>
            </div>
            <div className="bg-white/5 rounded-2xl p-5 text-center space-y-1">
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm font-semibold">
                <Globe className="h-4 w-4" /> 총 클릭 수
              </div>
              <div className="text-2xl font-bold text-cyan truncate px-2">{totalGlobalClicks.toLocaleString()}</div>
            </div>
            <div className="bg-white/5 rounded-2xl p-5 text-center space-y-1">
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm font-semibold">
                <Award className="h-4 w-4 text-yellow-500" /> 최고 순위
              </div>
              <div className="text-2xl font-bold">{selectedSchool ? `${myRank}위` : "-"}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
