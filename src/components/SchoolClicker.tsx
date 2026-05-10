"use client";

import { useState, useMemo, useEffect } from "react";
import { searchSchools, type School } from "@/lib/neis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Search, Trophy, Loader2, MapPin, 
  Phone, Link as LinkIcon, Calendar, GraduationCap, 
  Moon, Sun
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

export function SchoolClicker() {
  const db = useFirestore();
  const auth = useAuth();
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [localClicks, setLocalClicks] = useState(0);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (auth && !auth.currentUser) {
      signInAnonymously(auth).catch(() => {});
    }
  }, [auth]);

  const rankingQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "schools"), orderBy("score", "desc"), limit(10));
  }, [db]);
  
  const { data: rankingsData, isLoading: rankingsLoading } = useCollection(rankingQuery);
  const rankings = useMemo(() => rankingsData || [], [rankingsData]);

  const currentSchoolServerData = useMemo(() => {
    if (!selectedSchool || !rankings) return null;
    return rankings.find((r: any) => r.id === selectedSchool.SD_SCHUL_CODE);
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

  return (
    <div className="w-full min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <GraduationCap className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">SCHOOL CLICK</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-4 pt-6 space-y-6">
        <section>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full h-14 text-base font-semibold rounded-2xl border-2 hover:bg-secondary/50">
                <Search className="mr-2 h-4 w-4" /> 
                학교 검색
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>학교 검색</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="relative">
                  <Input
                    placeholder="학교 이름 입력 (2글자 이상)"
                    value={searchKeyword}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10 h-11"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-1">
                    {isSearching ? (
                      <div className="flex justify-center p-8"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((school, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectSchool(school)}
                          className="w-full text-left p-3 rounded-lg hover:bg-secondary transition-colors"
                        >
                          <div className="font-bold">{school.SCHUL_NM}</div>
                          <div className="text-xs text-muted-foreground">{school.ATPT_OFCDC_SC_NM}</div>
                        </button>
                      ))
                    ) : (
                      <div className="text-center p-8 text-sm text-muted-foreground">검색 결과가 없습니다.</div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>
        </section>

        <Card className="border-none shadow-sm bg-secondary/30 rounded-2xl overflow-hidden">
          <CardHeader className="py-4 px-6 border-b border-border/50">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" /> 실시간 순위
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {rankingsLoading ? (
                <div className="flex justify-center p-6"><Loader2 className="animate-spin h-5 w-5 text-primary" /></div>
              ) : rankings.length > 0 ? (
                rankings.map((school: any, idx: number) => (
                  <div key={school.id} className="flex items-center justify-between p-3 px-6 hover:bg-secondary/20 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className={`w-6 text-center text-sm font-black ${idx < 3 ? 'text-primary' : 'opacity-30'}`}>
                        {idx + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{school.name}</span>
                        <span className="text-[10px] text-muted-foreground">{school.officeName}</span>
                      </div>
                    </div>
                    <span className="font-black text-primary text-base">{(school.score || 0).toLocaleString()}</span>
                  </div>
                ))
              ) : (
                <div className="text-center p-6 text-sm text-muted-foreground">데이터가 없습니다.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <section className="text-center space-y-6 pt-4">
          <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tight">
              {selectedSchool ? selectedSchool.SCHUL_NM : "학교를 선택하세요"}
            </h2>
            {selectedSchool && (
              <p className="text-primary font-black text-lg">
                SCORE: {(currentSchoolServerData?.score || 0).toLocaleString()}
              </p>
            )}
          </div>

          <div className="py-4">
            <div className="text-7xl font-black mb-8 tabular-nums tracking-tighter">
              {localClicks.toLocaleString()}
            </div>
            <Button
              onClick={handleButtonClick}
              disabled={!selectedSchool}
              className="w-full h-28 text-3xl font-black rounded-[2rem] shadow-2xl shadow-primary/20 transition-all active:scale-95 click-btn-active"
            >
              CLICK!
            </Button>
          </div>

          {selectedSchool && (
            <div className="grid grid-cols-2 gap-3 text-left">
              <InfoRow 
                icon={<MapPin className="h-3 w-3" />} 
                label="주소 (지도 보기)" 
                value={selectedSchool.ORG_RDNMA} 
                isLink 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedSchool.SCHUL_NM + ' ' + selectedSchool.ORG_RDNMA)}`}
              />
              <InfoRow icon={<Phone className="h-3 w-3" />} label="전화" value={selectedSchool.ORG_TELNO} />
              <InfoRow icon={<LinkIcon className="h-3 w-3" />} label="웹사이트" value={selectedSchool.HMPG_ADRES} isLink />
              <InfoRow icon={<Calendar className="h-3 w-3" />} label="설립일" value={formatDate(selectedSchool.FOND_YMD)} />
            </div>
          )}
        </section>
      </main>

      <footer className="w-full py-10 text-center border-t mt-12 bg-secondary/10">
        <p className="text-xs font-bold text-muted-foreground tracking-widest opacity-40">©2026 KST</p>
      </footer>
    </div>
  );
}

function InfoRow({ icon, label, value, isLink, href }: { icon: any, label: string, value: string, isLink?: boolean, href?: string }) {
  if (!value || value === "정보 없음") return null;
  const linkHref = href || (value.startsWith('http') ? value : `http://${value}`);
  
  return (
    <div className="p-4 bg-secondary/30 rounded-2xl space-y-1 hover:bg-secondary/50 transition-colors">
      <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground uppercase tracking-wider">
        {icon} {label}
      </div>
      <div className="text-xs font-bold truncate">
        {isLink ? (
          <a href={linkHref} target="_blank" rel="noreferrer" className="text-primary hover:underline block">
            {href ? value : '홈페이지 방문'}
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