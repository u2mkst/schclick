"use client";

import { useState, useMemo, useEffect } from "react";
import { searchSchools, type School } from "@/lib/neis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Search, Trophy, Loader2, MousePointer2, MapPin, 
  Phone, Link as LinkIcon, Calendar, GraduationCap, 
  Crown, Medal, Award
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFirestore, useCollection, useAuth, useMemoFirebase } from "@/firebase";
import { doc, setDoc, increment, serverTimestamp, collection, query, orderBy, limit } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { cn } from "@/lib/utils";

export function SchoolClicker() {
  const db = useFirestore();
  const auth = useAuth();
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [localClicks, setLocalClicks] = useState(0);

  // 익명 로그인 (보안 규칙 통과용)
  useEffect(() => {
    if (auth && !auth.currentUser) {
      signInAnonymously(auth).catch((error) => {
        console.error("Anonymous auth failed", error);
      });
    }
  }, [auth]);

  // Firestore 실시간 랭킹 데이터
  const rankingQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "schools"), orderBy("score", "desc"), limit(10));
  }, [db]);
  
  const { data: rankingsData, isLoading: rankingsLoading } = useCollection(rankingQuery);
  const rankings = useMemo(() => rankingsData || [], [rankingsData]);

  // 선택된 학교의 실시간 서버 데이터
  const currentSchoolServerData = useMemo(() => {
    if (!selectedSchool || !rankings) return null;
    return rankings.find((r: any) => r.id === selectedSchool.SD_SCHUL_CODE);
  }, [rankings, selectedSchool]);

  // 내 학교 순위 계산
  const myRank = useMemo(() => {
    if (!selectedSchool || rankings.length === 0) return "-";
    const idx = rankings.findIndex((r: any) => r.id === selectedSchool.SD_SCHUL_CODE);
    return idx !== -1 ? idx + 1 : "10+";
  }, [rankings, selectedSchool]);

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
    setLocalClicks(0);
    setOpen(false);
    setSearchKeyword("");
    setSearchResults([]);
  };

  const handleButtonClick = () => {
    if (!selectedSchool || !db) return;

    // 로컬 클릭 피드백
    setLocalClicks(prev => prev + 1);

    const schoolRef = doc(db, "schools", selectedSchool.SD_SCHUL_CODE);
    
    // Firestore 서버에 실제 점수 기록
    setDoc(schoolRef, {
      id: selectedSchool.SD_SCHUL_CODE,
      name: selectedSchool.SCHUL_NM,
      officeName: selectedSchool.ATPT_OFCDC_SC_NM,
      schoolKind: selectedSchool.SCHUL_KND_SC_NM,
      score: increment(1),
      updatedAt: serverTimestamp()
    }, { merge: true })
    .catch(async () => {
      const permissionError = new FirestorePermissionError({
        path: schoolRef.path,
        operation: 'write',
        requestResourceData: { score: '+1' },
      });
      errorEmitter.emit('permission-error', permissionError);
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return "-";
    return `${dateStr.substring(0, 4)}년 ${dateStr.substring(4, 6)}월 ${dateStr.substring(6, 8)}일`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Header Section */}
      <div className="text-center space-y-4 pt-12 pb-6">
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2 float-animation">
          <GraduationCap className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-6xl font-black tracking-tighter text-white drop-shadow-2xl">
          SCHOOL <span className="text-primary italic">CLICK</span>
        </h1>
        <p className="text-muted-foreground text-xl font-medium max-w-xs mx-auto">전국 학교 대항 실시간 클릭 경쟁</p>
      </div>

      {/* School Search Button */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full h-20 text-xl font-bold rounded-[2rem] bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 shadow-2xl transition-all active:scale-[0.98] group">
            <Search className="mr-3 h-7 w-7 text-primary group-hover:scale-110 transition-transform" /> 
            우리 학교를 찾아보세요 (NEIS 데이터)
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md bg-card border-white/10 p-8 rounded-[2.5rem] backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black">학교 검색</DialogTitle>
          </DialogHeader>
          <div className="mt-6 space-y-6">
            <div className="relative">
              <Input
                placeholder="학교 이름을 입력하세요 (예: 서울고)"
                value={searchKeyword}
                onChange={(e) => handleSearch(e.target.value)}
                className="h-14 pl-12 bg-white/5 border-white/10 text-lg rounded-2xl focus:ring-primary focus:border-primary transition-all"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            </div>
            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-3">
                {isSearching ? (
                  <div className="flex flex-col items-center justify-center p-12 space-y-4">
                    <Loader2 className="animate-spin h-10 w-10 text-primary" />
                    <span className="text-muted-foreground font-medium animate-pulse">학교 정보 불러오는 중...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((school, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectSchool(school)}
                      className="w-full text-left p-5 rounded-2xl bg-white/5 hover:bg-white/[0.08] border border-transparent hover:border-white/10 transition-all group flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-xl group-hover:text-primary transition-colors">{school.SCHUL_NM}</div>
                        <div className="text-sm text-muted-foreground mt-1">{school.ATPT_OFCDC_SC_NM} · {school.SCHUL_KND_SC_NM}</div>
                      </div>
                      <MousePointer2 className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                    </button>
                  ))
                ) : searchKeyword.length >= 2 ? (
                  <div className="text-center p-12 text-muted-foreground font-medium">검색 결과가 없습니다.</div>
                ) : (
                  <div className="text-center p-12 text-muted-foreground font-medium leading-relaxed">
                    학교 이름을 <span className="text-primary">2글자 이상</span> 입력하여<br/>우리 학교의 자존심을 지켜주세요!
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rankings Leaderboard */}
      <Card className="glass-card border-none rounded-[2.5rem] overflow-hidden">
        <CardHeader className="p-8 pb-4 border-b border-white/5 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-3xl font-black italic">
            <Trophy className="text-yellow-500 h-8 w-8" /> 
            REAL-TIME <span className="text-primary">TOP 10</span>
          </CardTitle>
          <div className="px-3 py-1 bg-white/5 rounded-full text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">Live Server</div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-white/[0.03]">
            {rankingsLoading ? (
              <div className="flex justify-center p-20">
                <Loader2 className="animate-spin h-12 w-12 text-primary" />
              </div>
            ) : rankings.length > 0 ? (
              rankings.map((school: any, idx: number) => {
                const isMine = selectedSchool?.SD_SCHUL_CODE === school.id;
                return (
                  <div 
                    key={school.id} 
                    className={cn(
                      "flex items-center justify-between p-5 px-8 rank-item",
                      isMine ? 'bg-primary/20 hover:bg-primary/25' : ''
                    )}
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-10 flex justify-center">
                        {idx === 0 ? <Crown className="h-8 w-8 text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" /> :
                         idx === 1 ? <Medal className="h-7 w-7 text-gray-300" /> :
                         idx === 2 ? <Medal className="h-7 w-7 text-amber-600" /> :
                         <span className="text-xl font-bold text-white/20">0{idx + 1}</span>}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-xl tracking-tight">{school.name}</span>
                        <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">{school.officeName}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-cyan font-black text-2xl tabular-nums neon-glow">
                        {(school.score || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] font-bold text-white/20 uppercase tracking-tighter">Clicks</div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center p-20 text-muted-foreground font-medium">첫 번째 클릭을 기다리고 있습니다!</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Clicker Section */}
      <Card className="glass-card border-none rounded-[3rem] p-4">
        <CardContent className="p-8 space-y-10">
          <div className="text-center space-y-3">
            <h2 className={cn(
              "text-4xl font-black tracking-tight transition-all duration-500",
              selectedSchool ? "text-white" : "text-white/20"
            )}>
              {selectedSchool ? selectedSchool.SCHUL_NM : "학교를 선택하세요"}
            </h2>
            <div className="flex justify-center gap-6 text-sm font-bold tracking-widest uppercase">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Award className="h-4 w-4 text-primary" /> 순위: <span className="text-white">{selectedSchool ? (rankingsLoading ? "조회 중" : myRank + (typeof myRank === 'number' ? "위" : "")) : "-"}</span>
              </span>
              <span className="text-cyan flex items-center gap-1.5">
                <Trophy className="h-4 w-4" /> 서버 점수: <span className="neon-glow">{(currentSchoolServerData?.score || 0).toLocaleString()}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center py-6">
            <div className="text-8xl font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.2)] mb-3 animate-in zoom-in-50 duration-300" key={localClicks}>
              {localClicks.toLocaleString()}
            </div>
            <div className="text-xs font-black text-muted-foreground uppercase tracking-[0.4em] opacity-50">SESSION CLICKS</div>
          </div>

          <button
            onClick={handleButtonClick}
            disabled={!selectedSchool}
            className="w-full h-40 relative overflow-hidden bg-gradient-to-br from-primary via-blue-600 to-indigo-700 rounded-[2.5rem] shadow-[0_20px_50px_rgba(37,99,235,0.5)] transition-all click-btn-active disabled:opacity-20 disabled:cursor-not-allowed group"
          >
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-10 transition-opacity" />
            <div className="absolute inset-0 flex items-center justify-center opacity-10 group-active:scale-150 transition-transform duration-500">
              <MousePointer2 className="h-64 w-64 rotate-12" />
            </div>
            <div className="flex flex-col items-center justify-center gap-1 text-white relative z-10">
              <MousePointer2 className="h-10 w-10 animate-bounce mb-2" />
              <span className="text-5xl font-black tracking-widest drop-shadow-lg">CLICK!</span>
            </div>
          </button>

          {/* School Details Section */}
          {selectedSchool && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
              <div className="bg-white/[0.03] rounded-3xl p-6 space-y-3 border border-white/5 hover:bg-white/[0.06] transition-colors">
                <div className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-widest">
                  <MapPin className="h-4 w-4" /> Address
                </div>
                <div className="text-sm font-semibold leading-relaxed">{selectedSchool.ORG_RDNMA || "정보 없음"}</div>
              </div>
              <div className="bg-white/[0.03] rounded-3xl p-6 space-y-3 border border-white/5 hover:bg-white/[0.06] transition-colors">
                <div className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-widest">
                  <Phone className="h-4 w-4" /> Phone
                </div>
                <div className="text-sm font-semibold">{selectedSchool.ORG_TELNO || "정보 없음"}</div>
              </div>
              <div className="bg-white/[0.03] rounded-3xl p-6 space-y-3 border border-white/5 hover:bg-white/[0.06] transition-colors">
                <div className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-widest">
                  <LinkIcon className="h-4 w-4" /> Website
                </div>
                <div className="text-sm font-semibold truncate">
                  {selectedSchool.HMPG_ADRES ? (
                    <a href={selectedSchool.HMPG_ADRES.startsWith('http') ? selectedSchool.HMPG_ADRES : `http://${selectedSchool.HMPG_ADRES}`} target="_blank" rel="noreferrer" className="text-primary hover:underline transition-all">
                      {selectedSchool.HMPG_ADRES}
                    </a>
                  ) : "정보 없음"}
                </div>
              </div>
              <div className="bg-white/[0.03] rounded-3xl p-6 space-y-3 border border-white/5 hover:bg-white/[0.06] transition-colors">
                <div className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-widest">
                  <Calendar className="h-4 w-4" /> Anniversary
                </div>
                <div className="text-sm font-semibold">{formatDate(selectedSchool.FOND_YMD)}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="text-center pt-8 opacity-20 hover:opacity-100 transition-opacity">
        <p className="text-xs font-bold tracking-[0.2em] uppercase">© 2024 School Click · Global Leaderboard</p>
      </div>
    </div>
  );
}
