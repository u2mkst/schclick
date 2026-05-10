
"use client";

import { useState, useMemo, useEffect } from "react";
import { searchSchools, type School } from "@/lib/neis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Search, Trophy, Loader2, MapPin, 
  Phone, Link as LinkIcon, Calendar, GraduationCap, 
  Moon, Sun, Settings, RotateCcw, X, AlertCircle,
  MousePointer2, Globe, BadgeInfo, LogOut, Key, Trash2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFirestore, useCollection, useAuth, useMemoFirebase, useUser } from "@/firebase";
import { doc, setDoc, increment, serverTimestamp, collection, query, orderBy, limit, getDocs, writeBatch } from "firebase/firestore";
import { signInAnonymously, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function SchoolClicker() {
  const db = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isClickModalOpen, setIsClickModalOpen] = useState(false);
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [localClicks, setLocalClicks] = useState(0);
  const [myTotalClicks, setMyTotalClicks] = useState(0);
  const [isDark, setIsDark] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [isResettingAll, setIsResettingAll] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const themeIsDark = savedTheme === "dark";
    setIsDark(themeIsDark);
    if (themeIsDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    const savedClicks = localStorage.getItem("myTotalClicks");
    if (savedClicks) {
      setMyTotalClicks(parseInt(savedClicks, 10));
    }
  }, []);

  useEffect(() => {
    if (auth && !isUserLoading && !user) {
      signInAnonymously(auth).catch(() => {});
    }
  }, [auth, user, isUserLoading]);

  const isAdmin = useMemo(() => {
    return user && !user.isAnonymous;
  }, [user]);

  const rankingQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "schools"), orderBy("score", "desc"), limit(100));
  }, [db]);
  
  const { data: rankingsData, isLoading: rankingsLoading } = useCollection(rankingQuery);
  const allManagedSchools = useMemo(() => rankingsData || [], [rankingsData]);
  const rankings = useMemo(() => allManagedSchools.slice(0, 10), [allManagedSchools]);

  const filteredAdminSchools = useMemo(() => {
    if (!adminSearchQuery) return rankings;
    return allManagedSchools.filter(s => s.name.includes(adminSearchQuery));
  }, [allManagedSchools, rankings, adminSearchQuery]);

  const globalTotalClicks = useMemo(() => {
    return rankings.reduce((acc: number, school: any) => acc + (school.score || 0), 0);
  }, [rankings]);

  const currentSchoolServerData = useMemo(() => {
    if (!selectedSchool || !allManagedSchools) return null;
    return allManagedSchools.find((r: any) => r.id === selectedSchool.SD_SCHUL_CODE);
  }, [allManagedSchools, selectedSchool]);

  const currentRank = useMemo(() => {
    if (!selectedSchool || !allManagedSchools) return null;
    const index = allManagedSchools.findIndex((r: any) => r.id === selectedSchool.SD_SCHUL_CODE);
    return index !== -1 ? index + 1 : null;
  }, [allManagedSchools, selectedSchool]);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
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
      ATPT_OFCDC_SC_NM: rankData.cityProvinceName || "",
      SCHUL_KND_SC_NM: rankData.schoolKind || "",
      ORG_RDNMA: rankData.address || "정보 없음",
      ORG_TELNO: rankData.phone || "정보 없음",
      HMPG_ADRES: rankData.website || "정보 없음",
      FOND_YMD: rankData.founded || ""
    };
    setSelectedSchool(school);
    setLocalClicks(0);
    setIsClickModalOpen(true);
  };

  const handleButtonClick = () => {
    if (!selectedSchool || !db) return;
    
    const newLocal = localClicks + 1;
    const newTotal = myTotalClicks + 1;
    setLocalClicks(newLocal);
    setMyTotalClicks(newTotal);
    localStorage.setItem("myTotalClicks", newTotal.toString());

    const schoolRef = doc(db, "schools", selectedSchool.SD_SCHUL_CODE);
    setDoc(schoolRef, {
      id: selectedSchool.SD_SCHUL_CODE,
      name: selectedSchool.SCHUL_NM,
      cityProvinceName: selectedSchool.ATPT_OFCDC_SC_NM,
      schoolKind: selectedSchool.SCHUL_KND_SC_NM,
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
    if (!db || !isAdmin) return;
    const confirmReset = confirm("정말로 이 학교의 점수를 초기화하시겠습니까?");
    if (!confirmReset) return;

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

  const handleResetAllScores = async () => {
    if (!db || !isAdmin) return;
    const confirmReset = confirm("전체 학교의 점수를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.");
    if (!confirmReset) return;

    setIsResettingAll(true);
    try {
      const querySnapshot = await getDocs(collection(db, "schools"));
      const batch = writeBatch(db);
      
      querySnapshot.forEach((doc) => {
        batch.update(doc.ref, { score: 0, updatedAt: serverTimestamp() });
      });

      await batch.commit();
      toast({ title: "초기화 완료", description: "모든 학교의 점수가 0으로 초기화되었습니다." });
    } catch (error) {
      toast({ variant: "destructive", title: "초기화 실패", description: "권한이 없거나 오류가 발생했습니다." });
    } finally {
      setIsResettingAll(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setIsLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      setIsLoginDialogOpen(false);
      setIsAdminDialogOpen(true);
      setLoginEmail("");
      setLoginPassword("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "로그인 실패",
        description: "이메일 또는 비밀번호를 확인해주세요."
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    setIsAdminDialogOpen(false);
    toast({
      title: "로그아웃 완료",
      description: "익명 모드로 전환되었습니다."
    });
  };

  return (
    <div className="w-full min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <GraduationCap className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">SCHOOL CLICK</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => setIsAdminDialogOpen(true)} className="rounded-full text-primary">
                <Settings className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-4 pt-6 space-y-6">
        <section>
          <Button 
            variant="outline" 
            onClick={() => setIsSearchOpen(true)}
            className="w-full h-14 text-base font-semibold rounded-2xl border-2 hover:bg-secondary/50 justify-start px-6 shadow-sm transition-all active:scale-[0.98]"
          >
            <Search className="mr-3 h-5 w-5 text-muted-foreground" /> 
            우리 학교를 검색해보세요
          </Button>
        </section>

        <Card className="border-none shadow-none bg-secondary/20 rounded-3xl overflow-hidden">
          <CardHeader className="py-4 px-6">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" /> 실시간 명예의 전당 (TOP 10)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/20">
              {rankingsLoading ? (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>
              ) : rankings.length > 0 ? (
                rankings.map((school: any, idx: number) => (
                  <div 
                    key={school.id} 
                    onClick={() => selectSchoolFromRanking(school)}
                    className="flex items-center justify-between p-4 px-6 hover:bg-secondary/40 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        "w-6 text-center text-sm font-black transition-transform group-hover:scale-110",
                        idx === 0 ? "text-yellow-500 text-lg" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-amber-600" : "opacity-30"
                      )}>
                        {idx + 1}
                      </span>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm group-hover:text-primary transition-colors">{school.name}</span>
                          {school.schoolKind && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-md font-bold">
                              {school.schoolKind}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{school.cityProvinceName}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-primary text-base tabular-nums">{(school.score || 0).toLocaleString()}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center p-12 text-sm text-muted-foreground">아직 등록된 학교가 없습니다.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <section className="grid grid-cols-2 gap-4">
          <Card className="bg-primary/5 border-none rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary"><MousePointer2 className="h-5 w-5" /></div>
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">나의 누적 클릭</div>
              <div className="text-lg font-black tabular-nums">{myTotalClicks.toLocaleString()}</div>
            </div>
          </Card>
          <Card className="bg-secondary/30 border-none rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2 bg-secondary/50 rounded-xl text-muted-foreground"><Globe className="h-5 w-5" /></div>
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">전체 누적 점수</div>
              <div className="text-lg font-black tabular-nums">{globalTotalClicks.toLocaleString()}</div>
            </div>
          </Card>
        </section>
      </main>

      <footer className="w-full py-10 text-center border-t mt-12 bg-secondary/10">
        <button 
          onClick={() => isAdmin ? setIsAdminDialogOpen(true) : setIsLoginDialogOpen(true)}
          className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-30 hover:opacity-100 transition-opacity outline-none"
        >
          ©2026 KST
        </button>
      </footer>

      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" /> 학교 검색
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="relative">
              <Input
                placeholder="학교 이름을 입력하세요 (예: 서울초)"
                value={searchKeyword}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 h-12 rounded-xl focus-visible:ring-primary/30"
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
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base group-hover:text-primary transition-colors">{school.SCHUL_NM}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded-md font-bold text-muted-foreground">
                            {school.SCHUL_KND_SC_NM}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">{school.ATPT_OFCDC_SC_NM}</span>
                      </div>
                      <GraduationCap className="h-4 w-4 opacity-0 group-hover:opacity-100 text-primary transition-all" />
                    </button>
                  ))
                ) : searchKeyword.length >= 2 ? (
                  <div className="text-center p-12 text-sm text-muted-foreground">검색 결과가 없습니다.</div>
                ) : (
                  <div className="text-center p-12 text-sm text-muted-foreground">학교명을 2글자 이상 입력해주세요.</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isClickModalOpen} onOpenChange={setIsClickModalOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
          {selectedSchool && (
            <div className="flex flex-col">
              <div className="p-8 pb-4 text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">
                  {currentRank ? <Trophy className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}
                  {currentRank ? `전국 실시간 ${currentRank}위` : '순위 진입 중...'}
                </div>
                <DialogTitle className="text-2xl font-black tracking-tighter leading-tight">
                  {selectedSchool.SCHUL_NM}
                </DialogTitle>
                <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs font-medium">
                  <MapPin className="h-3.5 w-3.5" /> {selectedSchool.ATPT_OFCDC_SC_NM}
                  <span className="mx-1">•</span>
                  <BadgeInfo className="h-3.5 w-3.5" /> {selectedSchool.SCHUL_KND_SC_NM}
                </div>
              </div>

              <div className="px-8 py-6 text-center space-y-6">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-60">총 누적 점수</div>
                  <div className="text-5xl font-black text-primary tabular-nums tracking-tighter drop-shadow-sm">
                    {(currentSchoolServerData?.score || 0).toLocaleString()}
                  </div>
                </div>

                <div className="relative group">
                  <div className="absolute -inset-4 bg-primary/15 rounded-[3rem] blur-2xl group-active:blur-3xl transition-all opacity-0 group-active:opacity-100" />
                  <div className="relative">
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-3xl font-black text-primary animate-bounce pointer-events-none opacity-0 group-active:opacity-100 transition-opacity">
                      +{localClicks}
                    </div>
                    <Button
                      onClick={handleButtonClick}
                      className="w-full h-24 text-3xl font-black rounded-[2rem] shadow-2xl shadow-primary/20 transition-all active:scale-[0.96] bg-primary hover:bg-primary"
                    >
                      CLICK!
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2">
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
                  <X className="h-3.5 w-3.5 mr-1" /> 모달 닫기
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" /> 관리자 로그인
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdminLogin} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground ml-1">이메일</label>
              <Input 
                type="email" 
                placeholder="admin@example.com" 
                value={loginEmail} 
                onChange={(e) => setLoginEmail(e.target.value)} 
                required
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground ml-1">비밀번호</label>
              <Input 
                type="password" 
                placeholder="••••••••" 
                value={loginPassword} 
                onChange={(e) => setLoginPassword(e.target.value)} 
                required
                className="rounded-xl"
              />
            </div>
            <Button type="submit" className="w-full rounded-xl h-12 font-bold" disabled={isLoggingIn}>
              {isLoggingIn ? <Loader2 className="animate-spin h-5 w-5" /> : "로그인"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAdminDialogOpen} onOpenChange={setIsAdminDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
          <DialogHeader className="p-6 bg-primary/10 flex flex-row items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" /> 관리자 센터
            </DialogTitle>
            <div className="flex items-center gap-2">
               <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleResetAllScores} 
                disabled={isResettingAll}
                className="text-[10px] font-bold h-8 rounded-lg"
              >
                {isResettingAll ? <Loader2 className="animate-spin h-3 w-3 mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                전체 초기화
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs font-bold text-destructive">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </DialogHeader>
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="학교 검색 (Top 100 내)" 
                value={adminSearchQuery}
                onChange={(e) => setAdminSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-xl"
              />
            </div>
          </div>
          <div className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="divide-y divide-border/20">
                {filteredAdminSchools.length > 0 ? (
                  filteredAdminSchools.map((school: any) => (
                    <div key={school.id} className="flex items-center justify-between p-4 px-6 hover:bg-secondary/10 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">{school.name}</span>
                        <span className="text-[10px] text-muted-foreground">{(school.score || 0).toLocaleString()} clicks</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 rounded-lg text-[10px] font-bold text-destructive border-destructive/20 hover:bg-destructive/10"
                        onClick={() => handleResetScore(school.id)}
                      >
                        <RotateCcw className="h-3 w-3 mr-1.5" /> 리셋
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground gap-3">
                    <AlertCircle className="h-8 w-8 opacity-20" />
                    <p className="text-sm">검색 결과가 없거나 등록된 학교가 없습니다.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
          <div className="p-4 bg-secondary/10 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => setIsAdminDialogOpen(false)} className="rounded-full text-xs font-bold">
              센터 종료
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoItem({ icon, label, value, isLink, href }: { icon: any, label: string, value: string, isLink?: boolean, href?: string }) {
  if (!value || value === "정보 없음" || value === " ") return null;
  const linkHref = href || (value.startsWith('http') ? value : `http://${value}`);
  
  return (
    <div className="p-3 bg-secondary/30 rounded-2xl space-y-1 hover:bg-secondary/50 transition-colors text-left overflow-hidden border border-transparent hover:border-border/20">
      <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground uppercase tracking-wider">
        {icon} {label}
      </div>
      <div className="text-[10px] font-bold truncate">
        {isLink ? (
          <a href={linkHref} target="_blank" rel="noreferrer" className="text-primary hover:underline block truncate">
            {href ? "지도 보기" : "사이트 방문"}
          </a>
        ) : value}
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr || dateStr.length !== 8) return "";
  return `${dateStr.substring(0, 4)}년 ${dateStr.substring(4, 6)}월 ${dateStr.substring(6, 8)}일`;
}
