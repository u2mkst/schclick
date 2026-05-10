"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { searchSchools, getSchoolMeal, type School } from "@/lib/neis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Search, Trophy, Loader2, 
  GraduationCap, Moon, Sun, Settings, 
  MousePointer2, Globe, LogOut, 
  Key, Share2, ShieldAlert, UtensilsCrossed
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFirestore, useCollection, useAuth, useMemoFirebase, useUser } from "@/firebase";
import { doc, setDoc, increment, serverTimestamp, collection, query, orderBy, limit, getDocs, writeBatch } from "firebase/firestore";
import { signInAnonymously, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    Kakao: any;
    grecaptcha: any;
  }
}

const RECAPTCHA_SITE_KEY = "6LfWA-MsAAAAAHkBN0O36eVYQEUSWQOXzF0xz-k2";
const KAKAO_KEY = "619a98fc6bc8426aa8804d86591c7a6c";

export function SchoolClicker() {
  const db = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [mealInfo, setMealInfo] = useState<string>("불러오는 중...");
  const [isMealLoading, setIsMealLoading] = useState(false);
  
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isClickModalOpen, setIsClickModalOpen] = useState(false);
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isAntiBotOpen, setIsAntiBotOpen] = useState(false);
  
  const [localClicks, setLocalClicks] = useState(0);
  const [myTotalClicks, setMyTotalClicks] = useState(0);
  const [isDark, setIsDark] = useState(false);

  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const lastClickTimeRef = useRef<number>(0);
  const clickCountInSecondRef = useRef<number>(0);

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
    }

    const savedClicks = localStorage.getItem("myTotalClicks");
    if (savedClicks) {
      setMyTotalClicks(parseInt(savedClicks, 10));
    }

    const initKakao = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        try {
          window.Kakao.init(KAKAO_KEY);
        } catch (e) {
          console.error("Kakao Init Error:", e);
        }
      }
    };

    const interval = setInterval(() => {
      if (window.Kakao) {
        initKakao();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (auth && !isUserLoading && !user) {
      signInAnonymously(auth).catch(() => {});
    }
  }, [auth, user, isUserLoading]);

  // 학교 선택 시 급식 정보 가져오기
  useEffect(() => {
    if (isClickModalOpen && selectedSchool) {
      setIsMealLoading(true);
      setMealInfo("불러오는 중...");
      getSchoolMeal(selectedSchool.ATPT_OFCDC_SC_CODE, selectedSchool.SD_SCHUL_CODE)
        .then(res => {
          setMealInfo(res);
        })
        .catch(() => {
          setMealInfo("정보를 불러오지 못했습니다.");
        })
        .finally(() => {
          setIsMealLoading(false);
        });
    }
  }, [isClickModalOpen, selectedSchool]);

  const isAdmin = useMemo(() => user && !user.isAnonymous, [user]);

  const rankingQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "schools"), orderBy("score", "desc"), limit(100));
  }, [db]);
  
  const { data: rankingsData, isLoading: rankingsLoading } = useCollection(rankingQuery);
  const allManagedSchools = useMemo(() => rankingsData || [], [rankingsData]);
  const rankings = useMemo(() => allManagedSchools.slice(0, 10), [allManagedSchools]);

  const globalTotalClicks = useMemo(() => rankings.reduce((acc: number, s: any) => acc + (s.score || 0), 0), [rankings]);
  const currentSchoolServerData = useMemo(() => selectedSchool ? allManagedSchools.find((r: any) => r.id === selectedSchool.SD_SCHUL_CODE) : null, [allManagedSchools, selectedSchool]);
  const currentRank = useMemo(() => {
    if (!selectedSchool) return null;
    const idx = allManagedSchools.findIndex((r: any) => r.id === selectedSchool.SD_SCHUL_CODE);
    return idx !== -1 ? idx + 1 : null;
  }, [allManagedSchools, selectedSchool]);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    localStorage.setItem("theme", nextDark ? "dark" : "light");
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

  const handleButtonClick = () => {
    if (!selectedSchool || !db || isCoolingDown) return;

    const now = Date.now();
    if (now - lastClickTimeRef.current < 1000) {
      clickCountInSecondRef.current += 1;
      if (clickCountInSecondRef.current > 15) {
        setIsCoolingDown(true);
        setIsAntiBotOpen(true);
        return;
      }
    } else {
      clickCountInSecondRef.current = 1;
      lastClickTimeRef.current = now;
    }

    const executeClick = () => {
      setLocalClicks(prev => prev + 1);
      setMyTotalClicks(prev => {
        const next = prev + 1;
        localStorage.setItem("myTotalClicks", next.toString());
        return next;
      });

      const schoolRef = doc(db, "schools", selectedSchool.SD_SCHUL_CODE);
      setDoc(schoolRef, {
        id: selectedSchool.SD_SCHUL_CODE,
        name: selectedSchool.SCHUL_NM,
        cityProvinceName: selectedSchool.ATPT_OFCDC_SC_NM,
        schoolKind: selectedSchool.SCHUL_KND_SC_NM,
        address: selectedSchool.ORG_RDNMA,
        score: increment(1),
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
    };

    if (window.grecaptcha && typeof window.grecaptcha.ready === 'function') {
      window.grecaptcha.ready(() => {
        window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'click' })
          .then(executeClick)
          .catch((err: any) => {
            console.warn("reCAPTCHA failed, but proceeding click:", err);
            executeClick();
          });
      });
    } else {
      executeClick();
    }
  };

  const handleAntiBotConfirm = () => {
    setIsAntiBotOpen(false);
    setIsCoolingDown(false);
    clickCountInSecondRef.current = 0;
    lastClickTimeRef.current = Date.now();
    toast({
      title: "인증 완료",
      description: "다시 클릭할 수 있습니다.",
    });
  };

  const handleKakaoShare = () => {
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      toast({
        variant: "destructive",
        title: "공유 실패",
        description: "카카오 SDK가 준비 중입니다. 잠시 후 시도해주세요.",
      });
      return;
    }

    if (!selectedSchool) return;

    const score = currentSchoolServerData?.score || 0;
    const rankText = currentRank ? `전국 실시간 ${currentRank}위!` : '지금 바로 응원하세요!';
    
    try {
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `SCHOOL CLICK: ${selectedSchool.SCHUL_NM}`,
          description: `누적 점수: ${score.toLocaleString()}점 | ${rankText}`,
          imageUrl: 'https://picsum.photos/seed/school/600/315',
          link: { 
            mobileWebUrl: window.location.origin, 
            webUrl: window.location.origin 
          },
        },
        buttons: [
          { 
            title: '응원하러 가기', 
            link: { 
              mobileWebUrl: window.location.origin, 
              webUrl: window.location.origin 
            } 
          }
        ],
      });
    } catch (e) {
      console.error("Kakao Share Error:", e);
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <GraduationCap className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight headline">SCHOOL CLICK</h1>
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

      <main className="flex-1 max-w-xl mx-auto w-full px-4 pt-6 space-y-6 pb-20">
        <section>
          <Button 
            variant="outline" 
            onClick={() => setIsSearchOpen(true)}
            className="w-full h-14 text-base font-bold rounded-2xl border-2 hover:bg-primary/5 hover:border-primary/30 justify-start px-6 shadow-sm"
          >
            <Search className="mr-3 h-5 w-5 text-primary" /> 
            우리 학교를 검색해보세요
          </Button>
        </section>

        <Card className="border-none shadow-sm bg-card rounded-3xl overflow-hidden border">
          <CardHeader className="py-4 px-6 border-b bg-secondary/10">
            <CardTitle className="text-sm font-bold flex items-center gap-2 headline">
              <Trophy className="h-4 w-4 text-primary" /> 실시간 명예의 전당 (TOP 10)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {rankingsLoading ? (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>
              ) : rankings.length > 0 ? (
                rankings.map((school: any, idx: number) => (
                  <div 
                    key={school.id} 
                    onClick={() => selectSchool({
                      SD_SCHUL_CODE: school.id,
                      SCHUL_NM: school.name,
                      ATPT_OFCDC_SC_NM: school.cityProvinceName,
                      SCHUL_KND_SC_NM: school.schoolKind,
                      ATPT_OFCDC_SC_CODE: school.atptCode || "",
                      ORG_RDNMA: school.address || "",
                      ORG_TELNO: "",
                      HMPG_ADRES: "",
                      FOND_YMD: ""
                    })}
                    className="flex items-center justify-between p-4 px-6 hover:bg-primary/5 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        "w-6 text-center text-sm font-black tabular-nums",
                        idx === 0 ? "text-yellow-500 text-lg" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-amber-600" : "text-muted-foreground/40"
                      )}>
                        {idx + 1}
                      </span>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm group-hover:text-primary transition-colors">{school.name}</span>
                          {school.schoolKind && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-md font-bold">{school.schoolKind}</span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{school.cityProvinceName}</span>
                      </div>
                    </div>
                    <div className="font-black text-primary text-base tabular-nums">{(school.score || 0).toLocaleString()}</div>
                  </div>
                ))
              ) : (
                <div className="text-center p-12 text-sm text-muted-foreground">아직 등록된 학교가 없습니다.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <section className="grid grid-cols-2 gap-4">
          <Card className="bg-primary/5 border-primary/10 rounded-2xl p-4 flex items-center gap-3 border shadow-none">
            <div className="p-2 bg-primary/10 rounded-xl text-primary"><MousePointer2 className="h-5 w-5" /></div>
            <div>
              <div className="text-[10px] font-bold text-primary/60 uppercase tracking-wider">나의 누적 클릭</div>
              <div className="text-lg font-black tabular-nums text-primary">{myTotalClicks.toLocaleString()}</div>
            </div>
          </Card>
          <Card className="bg-secondary/30 border-secondary-foreground/10 rounded-2xl p-4 flex items-center gap-3 border shadow-none">
            <div className="p-2 bg-secondary/50 rounded-xl text-muted-foreground"><Globe className="h-5 w-5" /></div>
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">전체 누적 점수</div>
              <div className="text-lg font-black tabular-nums">{globalTotalClicks.toLocaleString()}</div>
            </div>
          </Card>
        </section>
      </main>

      <footer className="w-full py-10 text-center border-t mt-auto bg-secondary/10">
        <button 
          onClick={() => isAdmin ? setIsAdminDialogOpen(true) : setIsLoginDialogOpen(true)}
          className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-30 hover:opacity-100 transition-opacity"
        >
          ©2026 SCHOOL CLICK
        </button>
      </footer>

      {/* Search Dialog */}
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-card">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2 text-primary headline">
              <GraduationCap className="h-5 w-5" /> 학교 검색
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="relative">
              <Input
                placeholder="학교 이름을 입력하세요 (예: 서울초)"
                value={searchKeyword}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 h-12 rounded-xl bg-secondary/10 border-none"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/50" />
            </div>
            <ScrollArea className="h-[350px] -mx-2 px-2">
              <div className="space-y-1">
                {isSearching ? (
                  <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((school, idx) => (
                    <button key={idx} onClick={() => selectSchool(school)} className="w-full text-left p-4 rounded-xl hover:bg-primary/5 flex items-center justify-between group">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base group-hover:text-primary">{school.SCHUL_NM}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded-md font-bold">{school.SCHUL_KND_SC_NM}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{school.ATPT_OFCDC_SC_NM}</span>
                      </div>
                      <GraduationCap className="h-4 w-4 opacity-0 group-hover:opacity-100 text-primary" />
                    </button>
                  ))
                ) : searchKeyword.length >= 2 ? (
                  <div className="text-center p-12 text-sm text-muted-foreground">결과가 없습니다.</div>
                ) : (
                  <div className="text-center p-12 text-sm text-muted-foreground">학교명을 2글자 이상 입력하세요.</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Click Dialog */}
      <Dialog open={isClickModalOpen} onOpenChange={setIsClickModalOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl bg-card">
          {selectedSchool && (
            <div className="flex flex-col max-h-[90vh] overflow-y-auto">
              <div className="p-8 pb-4 text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">
                   <GraduationCap className="h-3 w-3" />
                  {currentRank ? `전국 실시간 ${currentRank}위` : '순위 진입 중...'}
                </div>
                <DialogTitle className="text-2xl font-black tracking-tighter headline">{selectedSchool.SCHUL_NM}</DialogTitle>
                <div className="text-muted-foreground text-xs">
                  {selectedSchool.ATPT_OFCDC_SC_NM} • {selectedSchool.SCHUL_KND_SC_NM}
                </div>
              </div>

              <div className="px-8 py-4 text-center space-y-6">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">총 누적 점수</div>
                  <div className="text-5xl font-black text-primary tabular-nums tracking-tighter">
                    {(currentSchoolServerData?.score || 0).toLocaleString()}
                  </div>
                </div>

                <Button
                  onClick={handleButtonClick}
                  className="w-full h-24 text-4xl font-black rounded-[2rem] shadow-xl transition-all active:scale-[0.96] bg-primary text-primary-foreground headline"
                >
                  CLICK!
                </Button>

                <div className="space-y-4">
                  {/* 오늘의 급식 섹션 */}
                  <div className="text-left space-y-2">
                    <div className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                      <UtensilsCrossed className="h-3 w-3" /> 오늘의 급식
                    </div>
                    <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10 min-h-[120px] flex flex-col justify-center">
                      {isMealLoading ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="animate-spin h-6 w-6 text-primary/50" />
                          <span className="text-xs text-muted-foreground font-bold">식단 정보 가져오는 중...</span>
                        </div>
                      ) : (
                        <p className="text-sm font-bold text-foreground/80 leading-relaxed whitespace-pre-line text-center">
                          {mealInfo}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pb-6">
                  <Button variant="outline" className="flex-1 rounded-2xl h-12 font-bold border-2" onClick={handleKakaoShare}>
                    <Share2 className="h-4 w-4 mr-2" /> 카톡 공유
                  </Button>
                  <Button variant="ghost" className="px-4 rounded-2xl h-12 opacity-40 font-bold" onClick={() => setIsClickModalOpen(false)}>닫기</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Anti-Bot Modal */}
      <Dialog open={isAntiBotOpen} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl border-none shadow-2xl bg-card p-8 text-center">
          <DialogHeader>
            <div className="mx-auto p-4 bg-primary/10 rounded-full w-fit mb-4">
              <ShieldAlert className="h-10 w-10 text-primary animate-pulse" />
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight headline">잠시 대기!</DialogTitle>
            <DialogDescription className="text-base font-bold text-foreground/80 pt-2">
              비정상적으로 빠른 클릭이 감지되었습니다.<br />
              혹시 <span className="text-primary underline underline-offset-4">로봇이 아닙니까?</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-8">
            <Button 
              onClick={handleAntiBotConfirm} 
              className="w-full h-14 rounded-2xl text-lg font-black headline"
            >
              로봇이 아닙니다
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Login Dialog */}
      <Dialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl border-none shadow-2xl bg-card">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-primary headline"><Key className="h-5 w-5" /> 관리자 로그인</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            setIsLoggingIn(true);
            signInWithEmailAndPassword(auth!, loginEmail, loginPassword)
              .then(() => { setIsLoginDialogOpen(false); setIsAdminDialogOpen(true); })
              .catch(() => toast({ variant: "destructive", title: "로그인 실패" }))
              .finally(() => setIsLoggingIn(false));
          }} className="space-y-4 py-4">
            <Input type="email" placeholder="이메일" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="rounded-xl" required />
            <Input type="password" placeholder="비밀번호" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="rounded-xl" required />
            <Button type="submit" className="w-full rounded-xl h-12 font-bold" disabled={isLoggingIn}>
              {isLoggingIn ? <Loader2 className="animate-spin" /> : "로그인"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Admin Control Dialog */}
      <Dialog open={isAdminDialogOpen} onOpenChange={setIsAdminDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-card">
          <DialogHeader className="p-6 bg-primary/10 flex flex-row items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-primary headline"><Settings className="h-5 w-5" /> 관리자 센터</DialogTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="destructive" className="h-8 text-[10px] font-bold" onClick={async () => {
                if(!confirm("모든 학교의 점수를 초기화하시겠습니까?")) return;
                setIsResettingAll(true);
                try {
                  const snap = await getDocs(collection(db!, "schools"));
                  const batch = writeBatch(db!);
                  snap.forEach(d => batch.update(d.ref, { score: 0 }));
                  await batch.commit();
                  toast({ title: "초기화 완료", description: "모든 점수가 0으로 설정되었습니다." });
                } catch (e) {
                  toast({ variant: "destructive", title: "초기화 실패" });
                } finally {
                  setIsResettingAll(false);
                }
              }} disabled={isResettingAll}>{isResettingAll ? "중..." : "전체 초기화"}</Button>
              <Button variant="ghost" size="sm" onClick={() => { signOut(auth!); setIsAdminDialogOpen(false); }} className="text-destructive"><LogOut className="h-4 w-4" /></Button>
            </div>
          </DialogHeader>
          <div className="p-4 bg-secondary/5 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="등록된 학교 검색" value={adminSearchQuery} onChange={(e) => setAdminSearchQuery(e.target.value)} className="pl-9" />
            </div>
          </div>
          <ScrollArea className="h-[400px]">
            <div className="divide-y">
              {allManagedSchools
                .filter(s => s.name.includes(adminSearchQuery))
                .map((school: any) => (
                <div key={school.id} className="flex items-center justify-between p-4 px-6">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">{school.name}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{school.score.toLocaleString()} clicks</span>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 text-destructive font-bold" onClick={() => setDoc(doc(db!, "schools", school.id), { score: 0 }, { merge: true })}>리셋</Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
