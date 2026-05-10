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

    setLocalClicks(prev => prev + 1);

    const schoolRef = doc(db, "schools", selectedSchool.SD_SCHUL_CODE);
    
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
    <div className="w-full min-h-screen bg-background text-foreground selection:bg-primary/30 pb-20">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            <GraduationCap className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black tracking-tighter">
              SCHOOL <span className="text-primary italic">CLICK</span>
            </h1>
          </div>
          <div className="px-3 py-1 bg-primary/10 rounded-full">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest animate-pulse">Live Server</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-8 pt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* School Search Section */}
        <section>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="w-full h-16 text-lg font-bold rounded-3xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 shadow-xl transition-all active:scale-[0.98] group">
                <Search className="mr-3 h-5 w-5 text-primary group-hover:scale-110 transition-transform" /> 
                우리 학교 찾기
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-card border-white/10 p-8 rounded-[2.5rem] backdrop-blur-3xl shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">학교 검색</DialogTitle>
              </DialogHeader>
              <div className="mt-6 space-y-6">
                <div className="relative">
                  <Input
                    placeholder="학교 이름을 입력하세요"
                    value={searchKeyword}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="h-12 pl-10 bg-white/5 border-white/10 text-md rounded-xl focus:ring-primary"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-2">
                    {isSearching ? (
                      <div className="flex flex-col items-center justify-center p-12 space-y-4">
                        <Loader2 className="animate-spin h-8 w-8 text-primary" />
                        <span className="text-muted-foreground text-sm font-medium">검색 중...</span>
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((school, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectSchool(school)}
                          className="w-full text-left p-4 rounded-xl bg-white/5 hover:bg-white/[0.08] border border-transparent hover:border-white/10 transition-all group flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-lg group-hover:text-primary transition-colors">{school.SCHUL_NM}</div>
                            <div className="text-xs text-muted-foreground mt-1">{school.ATPT_OFCDC_SC_NM}</div>
                          </div>
                          <MousePointer2 className="h-4 w-4 opacity-0 group-hover:opacity-100 text-primary" />
                        </button>
                      ))
                    ) : (
                      <div className="text-center p-12 text-muted-foreground text-sm">학교 이름을 입력해 주세요.</div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>
        </section>

        {/* Real-time Ranking Card */}
        <Card className="glass-card border-none rounded-[2rem] overflow-hidden">
          <CardHeader className="p-6 pb-4 border-b border-white/5 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl font-black italic">
              <Trophy className="text-yellow-500 h-5 w-5" /> 
              REAL-TIME <span className="text-primary">TOP 10</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/[0.03]">
              {rankingsLoading ? (
                <div className="flex justify-center p-12">
                  <Loader2 className="animate-spin h-8 w-8 text-primary" />
                </div>
              ) : rankings.length > 0 ? (
                rankings.map((school: any, idx: number) => {
                  const isMine = selectedSchool?.SD_SCHUL_CODE === school.id;
                  return (
                    <div 
                      key={school.id} 
                      className={cn(
                        "flex items-center justify-between p-4 px-6 rank-item",
                        isMine ? 'bg-primary/15 border-l-4 border-l-primary' : ''
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 flex justify-center">
                          {idx === 0 ? <Crown className="h-6 w-6 text-yellow-500" /> :
                           idx === 1 ? <Medal className="h-5 w-5 text-gray-300" /> :
                           idx === 2 ? <Medal className="h-5 w-5 text-amber-600" /> :
                           <span className="text-sm font-bold text-white/20">{idx + 1}</span>}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-lg tracking-tight">{school.name}</span>
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase">{school.officeName}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-cyan font-black text-xl tabular-nums neon-glow">
                          {(school.score || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center p-12 text-muted-foreground font-medium">데이터 대기 중...</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Interaction Card */}
        <Card className="glass-card border-none rounded-[2.5rem]">
          <CardContent className="p-8 space-y-8">
            <div className="text-center space-y-2">
              <h2 className={cn(
                "text-3xl font-black tracking-tight transition-all",
                selectedSchool ? "text-white" : "text-white/20"
              )}>
                {selectedSchool ? selectedSchool.SCHUL_NM : "학교를 선택해 주세요"}
              </h2>
              <div className="flex justify-center gap-4 text-[10px] font-bold tracking-widest uppercase">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Award className="h-3 w-3 text-primary" /> RANK: <span className="text-white">{selectedSchool ? myRank : "-"}</span>
                </span>
                <span className="text-cyan flex items-center gap-1">
                  <Trophy className="h-3 w-3" /> SCORE: <span className="neon-glow">{(currentSchoolServerData?.score || 0).toLocaleString()}</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center">
              <div className="text-7xl font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] mb-1 animate-in zoom-in-50 duration-200" key={localClicks}>
                {localClicks.toLocaleString()}
              </div>
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-40">SESSION</div>
            </div>

            <button
              onClick={handleButtonClick}
              disabled={!selectedSchool}
              className="w-full h-32 relative overflow-hidden bg-gradient-to-br from-primary to-blue-700 rounded-[2rem] shadow-2xl transition-all click-btn-active disabled:opacity-10 group"
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-10 transition-opacity" />
              <div className="flex flex-col items-center justify-center text-white relative z-10">
                <MousePointer2 className="h-8 w-8 animate-bounce mb-1" />
                <span className="text-4xl font-black tracking-widest">CLICK!</span>
              </div>
            </button>

            {/* School Real Info */}
            {selectedSchool && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <InfoItem icon={<MapPin />} label="Address" value={selectedSchool.ORG_RDNMA} />
                <InfoItem icon={<Phone />} label="Phone" value={selectedSchool.ORG_TELNO} />
                <InfoItem icon={<LinkIcon />} label="Website" value={selectedSchool.HMPG_ADRES} isLink />
                <InfoItem icon={<Calendar />} label="Founded" value={formatDate(selectedSchool.FOND_YMD)} />
              </div>
            )}
          </CardContent>
        </Card>
        
        <footer className="text-center pt-8 opacity-20 hover:opacity-100 transition-opacity">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase">© 2024 SCHOOL CLICK · REAL-TIME COMPETITION</p>
        </footer>
      </main>
    </div>
  );
}

function InfoItem({ icon, label, value, isLink }: { icon: any, label: string, value: string, isLink?: boolean }) {
  return (
    <div className="bg-white/[0.02] rounded-2xl p-4 space-y-1 border border-white/5 hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-1.5 text-primary text-[10px] font-black uppercase tracking-widest">
        {icon} {label}
      </div>
      <div className="text-xs font-semibold truncate">
        {isLink && value !== "정보 없음" ? (
          <a href={value.startsWith('http') ? value : `http://${value}`} target="_blank" rel="noreferrer" className="text-primary hover:underline transition-all">
            {value}
          </a>
        ) : (value || "정보 없음")}
      </div>
    </div>
  );
}
