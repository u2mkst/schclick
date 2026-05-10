
"use client";

import { useState, useMemo, useEffect } from "react";
import { searchSchools, type School } from "@/lib/neis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Search, Trophy, Loader2, MapPin, 
  Phone, Link as LinkIcon, Calendar, GraduationCap, 
  Moon, Sun, Settings, RotateCcw, X
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  
  // State
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isClickModalOpen, setIsClickModalOpen] = useState(false);
  const [localClicks, setLocalClicks] = useState(0);
  const [isDark, setIsDark] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);

  // Auth
  useEffect(() => {
    if (auth && !auth.currentUser) {
      signInAnonymously(auth).catch(() => {});
    }
  }, [auth]);

  // Firestore Rankings
  const rankingQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "schools"), orderBy("score", "desc"), limit(10));
  }, [db]);
  
  const { data: rankingsData, isLoading: rankingsLoading } = useCollection(rankingQuery);
  const rankings = useMemo(() => rankingsData || [], [rankingsData]);

  // Current School Data from Server
  const currentSchoolServerData = useMemo(() => {
    if (!selectedSchool || !rankings) return null;
    return rankings.find((r: any) => r.id === selectedSchool.SD_SCHUL_CODE);
  }, [rankings, selectedSchool]);

  // Rank Calculation
  const currentRank = useMemo(() => {
    if (!selectedSchool || !rankings) return null;
    const index = rankings.findIndex((r: any) => r.id === selectedSchool.SD_SCHUL_CODE);
    return index !== -1 ? index + 1 : null;
  }, [rankings, selectedSchool]);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

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
    setIsSearchOpen(false);
    setIsClickModalOpen(true);
  };

  const selectSchoolFromRanking = (rankData: any) => {
    const school: School = {
      SD_SCHUL_CODE: rankData.id,
      SCHUL_NM: rankData.name,
      ATPT_OFCDC_SC_NM: rankData.officeName,
      ORG_RDNMA: rankData.address || "정보 없음",
      ORG_TELNO: rankData.phone || "정보 없음",
      HMPG_ADRES: rankData.website || "정보 없음",
      FOND_YMD: rankData.founded || "",
      SCHUL_KND_SC_NM: ""
    };
    setSelectedSchool(school);
    setLocalClicks(0);
    setIsClickModalOpen(true);
  };

  const handleButtonClick = () => {
    if (!selectedSchool || !db) return;
    setLocalClicks(prev => prev + 1);
    const schoolRef = doc(db, "schools", selectedSchool.SD_SCHUL_CODE);
    setDoc(schoolRef, {
      id: selectedSchool.SD_SCHUL_CODE,
      name: selectedSchool.SCHUL_NM,
      officeName: selectedSchool.ATPT_OFCDC_SC_NM,
      address: selectedSchool.ORG_RDNMA,
      phone: selectedSchool.ORG_TELNO,
      website: selectedSchool.HMPG_ADRES,
      founded: selectedSchool.FOND_YMD,
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

  const handleResetScore = (schoolId: string) => {
    if (!db) return;
    const schoolRef = doc(db, "schools", schoolId);
    setDoc(schoolRef, { score: 0, updatedAt: serverTimestamp() }, { merge: true })
    .catch(async () => {
      const permissionError = new FirestorePermissionError({
        path: schoolRef.path,
        operation: 'write',
        requestResourceData: { score: 0 },
      });
      errorEmitter.emit('permission-error', permissionError);
    });
  };

  const toggleAdminMode = () => {
    if (isAdminMode) {
      setIsAdminMode(false);
      return;
    }
    const password = prompt("관리자 비밀번호를 입력하세요:");
    if (password === "kst12345") {
      setIsAdminMode(true);
    } else if (password !== null) {
      alert("비밀번호가 올바르지 않습니다.");
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <GraduationCap className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">SCHOOL CLICK</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-4 pt-6 space-y-6">
        <section>
          <Button 
            variant="outline" 
            onClick={() => setIsSearchOpen(true)}
            className="w-full h-14 text-base font-semibold rounded-2xl border-2 hover:bg-secondary/50 justify-start px-6"
          >
            <Search className="mr-3 h-5 w-5 text-muted-foreground" /> 
            우리 학교를 검색해보세요
          </Button>
        </section>

        <Card className="border-none shadow-none bg-secondary/20 rounded-2xl overflow-hidden">
          <CardHeader className="py-4 px-6">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" /> 실시간 명예의 전당 (TOP 10)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/20">
              {rankingsLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>
              ) : rankings.length > 0 ? (
                rankings.map((school: any, idx: number) => (
                  <div 
                    key={school.id} 
                    onClick={() => selectSchoolFromRanking(school)}
                    className="flex items-center justify-between p-4 px-6 hover:bg-secondary/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        "w-6 text-center text-sm font-black",
                        idx === 0 ? "text-yellow-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-amber-600" : "opacity-30"
                      )}>
                        {idx + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{school.name}</span>
                        <span className="text-[10px] text-muted-foreground">{school.officeName}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-primary text-base">{(school.score || 0).toLocaleString()}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center p-10 text-sm text-muted-foreground">아직 등록된 학교가 없습니다.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {isAdminMode && (
          <Card className="border-2 border-primary/20 bg-primary/5 rounded-2xl overflow-hidden mt-8">
            <CardHeader className="py-4 px-6 bg-primary/10">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Settings className="h-4 w-4" /> 관리자 데이터 센터
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div className="divide-y divide-border/20">
                {rankings.map((school: any) => (
                  <div key={school.id} className="flex items-center justify-between p-3 px-6">
                    <span className="text-xs font-bold">{school.name}</span>
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      className="h-7 text-[10px]"
                      onClick={() => handleResetScore(school.id)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" /> 점수 초기화
                    </Button>
                  </div>
                ))}
               </div>
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="w-full py-10 text-center border-t mt-12 bg-secondary/10">
        <div className="flex flex-col items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-[10px] opacity-30 hover:opacity-100 h-6 px-2"
            onClick={toggleAdminMode}
          >
            {isAdminMode ? "ADMIN OFF" : "ADMIN ON"}
          </Button>
          <p className="text-xs font-bold text-muted-foreground tracking-widest opacity-40">©2026 KST</p>
        </div>
      </footer>

      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>학교 검색</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="relative">
              <Input
                placeholder="학교 이름을 입력하세요 (예: 서울고)"
                value={searchKeyword}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 h-12 rounded-xl"
                autoFocus
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            </div>
            <ScrollArea className="h-[350px] -mx-2 px-2">
              <div className="space-y-1">
                {isSearching ? (
                  <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((school, idx) => (
                    <button
                      key={idx}
                      onClick={() => selectSchool(school)}
                      className="w-full text-left p-4 rounded-xl hover:bg-secondary transition-all flex items-center justify-between group"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-base group-hover:text-primary transition-colors">{school.SCHUL_NM}</span>
                        <span className="text-xs text-muted-foreground">{school.ATPT_OFCDC_SC_NM}</span>
                      </div>
                      <GraduationCap className="h-4 w-4 opacity-0 group-hover:opacity-100 text-primary transition-all" />
                    </button>
                  ))
                ) : searchKeyword.length >= 2 ? (
                  <div className="text-center p-12 text-sm text-muted-foreground">검색 결과가 없습니다.</div>
                ) : (
                  <div className="text-center p-12 text-sm text-muted-foreground">2글자 이상 입력해주세요.</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isClickModalOpen} onOpenChange={setIsClickModalOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
          {selectedSchool && (
            <div className="flex flex-col">
              <div className="p-8 pb-4 text-center space-y-2">
                <div className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">
                  {currentRank ? `현재 실시간 ${currentRank}위` : '순위 진입 중...'}
                </div>
                <DialogTitle className="text-3xl font-black tracking-tighter leading-tight">
                  {selectedSchool.SCHUL_NM}
                </DialogTitle>
                <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
                  <MapPin className="h-3 w-3" /> {selectedSchool.ATPT_OFCDC_SC_NM}
                </div>
              </div>

              <div className="px-8 py-6 text-center space-y-6">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-60">총 누적 점수</div>
                  <div className="text-5xl font-black text-primary tabular-nums tracking-tighter">
                    {(currentSchoolServerData?.score || 0).toLocaleString()}
                  </div>
                </div>

                <div className="relative group">
                  <div className="absolute -inset-4 bg-primary/10 rounded-[2.5rem] blur-2xl group-active:blur-3xl transition-all" />
                  <div className="relative">
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-2xl font-black text-primary animate-bounce pointer-events-none opacity-0 group-active:opacity-100">
                      +{localClicks}
                    </div>
                    <Button
                      onClick={handleButtonClick}
                      className="w-full h-32 text-4xl font-black rounded-[2rem] shadow-2xl shadow-primary/20 transition-all active:scale-[0.98] click-btn-active bg-primary hover:bg-primary"
                    >
                      CLICK!
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-4">
                  <InfoItem 
                    icon={<MapPin className="h-3 w-3" />} 
                    label="주소" 
                    value={selectedSchool.ORG_RDNMA} 
                    isLink 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedSchool.SCHUL_NM + ' ' + selectedSchool.ORG_RDNMA)}`}
                  />
                  <InfoItem icon={<Phone className="h-3 w-3" />} label="전화" value={selectedSchool.ORG_TELNO} />
                  <InfoItem icon={<LinkIcon className="h-3 w-3" />} label="웹사이트" value={selectedSchool.HMPG_ADRES} isLink />
                  <InfoItem icon={<Calendar className="h-3 w-3" />} label="설립일" value={formatDate(selectedSchool.FOND_YMD)} />
                </div>
              </div>
              
              <div className="p-4 bg-secondary/20 flex justify-center">
                <Button variant="ghost" size="sm" onClick={() => setIsClickModalOpen(false)} className="rounded-full text-xs font-bold opacity-40 hover:opacity-100">
                  <X className="h-3 w-3 mr-1" /> 닫기
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoItem({ icon, label, value, isLink, href }: { icon: any, label: string, value: string, isLink?: boolean, href?: string }) {
  if (!value || value === "정보 없음") return null;
  const linkHref = href || (value.startsWith('http') ? value : `http://${value}`);
  
  return (
    <div className="p-3 bg-secondary/30 rounded-2xl space-y-1 hover:bg-secondary/50 transition-colors text-left overflow-hidden">
      <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground uppercase tracking-wider">
        {icon} {label}
      </div>
      <div className="text-[10px] font-bold truncate">
        {isLink ? (
          <a href={linkHref} target="_blank" rel="noreferrer" className="text-primary hover:underline block truncate">
            {href ? value : '지도 보기'}
          </a>
        ) : value}
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr || dateStr.length !== 8) return "";
  return `${dateStr.substring(0, 4)}.${dateStr.substring(4, 6)}.${dateStr.substring(6, 8)}`;
}
