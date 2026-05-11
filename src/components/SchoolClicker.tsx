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
  Key, Share2, ShieldAlert, UtensilsCrossed,
  Star, Crown
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
  
  const [bestMealInfo, setBestMealInfo] = useState<string>("");
  const [isBestMealLoading, setIsBestMealLoading] = useState(false);
  const fetchedBestMealId = useRef<string>("");

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
  const [hasDaebaked, setHasDaebaked] = useState(false);

  // 안티봇 관련 상태
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [suspiciousClicks, setSuspiciousClicks] = useState(0);
  const [isBotBlocked, setIsBotBlocked] = useState(false);
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

  // 대박 클릭 여부 체크
  useEffect(() => {
    if (selectedSchool) {
      const daebakKey = `daebak_${selectedSchool.SD_SCHUL_CODE}`;
      setHasDaebaked(!!localStorage.getItem(daebakKey));
    }
  }, [selectedSchool]);

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
    return query(collection(db, "schools"), orderBy("score", "desc"), limit(10));
  }, [db]);
  
  const { data: rankingsData, isLoading: rankingsLoading } = useCollection(rankingQuery);
  const rankings = useMemo(() => rankingsData || [], [rankingsData]);

  // 1위 학교와 나머지 학교 분리
  const rank1School = useMemo(() => rankings[0] || null, [rankings]);
  const otherRankings = useMemo(() => rankings.slice(1), [rankings]);

  const bestMealQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "schools"), orderBy("daebakScore", "desc"), limit(1));
  }, [db]);
  const { data: bestMealSchoolData } = useCollection(bestMealQuery);
  const bestMealSchool = useMemo(() => bestMealSchoolData?.[0] || null, [bestMealSchoolData]);

  useEffect(() => {
    if (bestMealSchool && bestMealSchool.id !== fetchedBestMealId.current) {
      fetchedBestMealId.current = bestMealSchool.id;
      setIsBestMealLoading(true);
      getSchoolMeal(bestMealSchool.atptCode || "", bestMealSchool.id)
        .then(res => setBestMealInfo(res))
        .catch(() => setBestMealInfo("식단 정보를 불러올 수 없습니다."))
        .finally(() => setIsBestMealLoading(false));
    }
  }, [bestMealSchool]);

  const globalTotalClicks = useMemo(() => rankings.reduce((acc: number, s: any) => acc + (s.score || 0), 0), [rankings]);
  const currentSchoolServerData = useMemo(() => selectedSchool ? rankings.find((r: any) => r.id === selectedSchool.SD_SCHUL_CODE) : null, [rankings, selectedSchool]);
  const currentRank = useMemo(() => {
    if (!selectedSchool) return null;
    const idx = rankings.findIndex((r: any) => r.id === selectedSchool.SD_SCHUL_CODE);
    return idx !== -1 ? idx + 1 : null;
  }, [rankings, selectedSchool]);

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
    if (isBotBlocked) return;
    setSelectedSchool(school);
    setLocalClicks(0);
    setIsSearchOpen(false);
    setIsClickModalOpen(true);
  };

  const handleButtonClick = (type: "normal" | "daebak" = "normal") => {
    if (!selectedSchool || !db || isCoolingDown || isBotBlocked) return;

    if (type === "daebak" && hasDaebaked) {
      toast({
        title: "이미 참여 완료",
        description: "대박 클릭은 학교당 한 번만 가능합니다!",
      });
      return;
    }

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
      if (type === "daebak") {
        const daebakKey = `daebak_${selectedSchool.SD_SCHUL_CODE}`;
        localStorage.setItem(daebakKey, "true");
        setHasDaebaked(true);
      } else {
        setLocalClicks(prev => prev + 1);
        setMyTotalClicks(prev => {
          const next = prev + 1;
          localStorage.setItem("myTotalClicks", next.toString());
          return next;
        });
      }

      const schoolRef = doc(db, "schools", selectedSchool.SD_SCHUL_CODE);
      const updateData: any = {
        id: selectedSchool.SD_SCHUL_CODE,
        name: selectedSchool.SCHUL_NM,
        cityProvinceName: selectedSchool.ATPT_OFCDC_SC_NM,
        atptCode: selectedSchool.ATPT_OFCDC_SC_CODE,
        schoolKind: selectedSchool.SCHUL_KND_SC_NM,
        address: selectedSchool.ORG_RDNMA,
        updatedAt: serverTimestamp()
      };

      if (type === "normal") {
        updateData.score = increment(1);
      } else {
        updateData.daebakScore = increment(1);
      }

      setDoc(schoolRef, updateData, { merge: true }).catch(() => {});
      
      if (type === "daebak") {
        toast({
          title: "👍 대박!",
          description: "베스트 급식 학교 선정에 큰 힘이 됩니다!",
        });
      }
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
    if (isBotBlocked) return;
    setIsAntiBotOpen(false);
    setIsCoolingDown(false);
    setSuspiciousClicks(0);
    clickCountInSecondRef.current = 0;
    lastClickTimeRef.current = Date.now();
    toast({
      title: "인증 완료",
      description: "다시 클릭할 수 있습니다.",
    });
  };

  const handleKakaoShare = () => {
    if (isBotBlocked) return;
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
    <div className={cn("w-full min-h-screen flex flex-col bg-background text-foreground", isBotBlocked && "pointer-events-none")}>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => !isBotBlocked && window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <GraduationCap className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight headline">SCHOOL CLICK</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => !isBotBlocked && toggleTheme()} className="rounded-full">
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => !isBotBlocked && setIsAdminDialogOpen(true)} className="rounded-full text-primary">
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
            onClick={() => !isBotBlocked && setIsSearchOpen(true)}
            disabled={isBotBlocked}
            className="w-full h-14 text-base font-bold rounded-2xl border-2 hover:bg-primary/5 hover:border-primary/30 justify-start px-6 shadow-sm"
          >
            <Search className="mr-3 h-5 w-5 text-primary" /> 
            우리 학교를 검색해보세요
          </Button>
        </section>

        {bestMealSchool && (
          <Card className="border-none shadow-xl bg-gradient-to-br from-amber-50 to-white dark:from-zinc-900/50 dark:to-zinc-900/30 rounded-[2.5rem] overflow-hidden border-2 border-amber-200/50 dark:border-amber-900/30 transition-all hover:shadow-2xl">
            <CardHeader className="py-5 px-8 border-b border-amber-100/50 dark:border-amber-900/20 bg-amber-100/20 dark:bg-amber-900/10 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-black flex items-center gap-2 text-amber-600 dark:text-amber-400 headline">
                <Star className="h-4 w-4 fill-amber-500" /> 오늘의 대박 급식
              </CardTitle>
              <div className="px-3 py-1 bg-amber-500 text-white text-[10px] font-black rounded-full uppercase tracking-tighter shadow-sm animate-pulse">#1 DAEBAK</div>
            </CardHeader>
            <CardContent className="p-8 space-y-5">
              <div className="flex flex-col items-center text-center space-y-2">
                <h2 className="text-2xl font-black headline text-foreground tracking-tighter">{bestMealSchool.name}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-lg">{bestMealSchool.cityProvinceName}</span>
                  <span className="text-[11px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">{bestMealSchool.daebakScore?.toLocaleString() || 0} DAEBAK</span>
                </div>
              </div>
              <div className="p-6 bg-white dark:bg-zinc-800/50 border border-amber-100/50 dark:border-amber-900/20 rounded-3xl shadow-inner min-h-[120px] flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><UtensilsCrossed className="h-16 w-16 text-amber-500" /></div>
                {isBestMealLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="animate-spin h-6 w-6 text-amber-500/50" /></div>
                ) : (
                  <p className="text-sm font-bold text-foreground/80 leading-relaxed whitespace-pre-line text-center relative z-10">
                    {bestMealInfo || "급식 정보를 불러올 수 없습니다."}
                  </p>
                )}
              </div>
              <Button 
                variant="ghost" 
                className="w-full text-amber-600 dark:text-amber-400 font-bold text-sm hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-2xl h-12"
                onClick={() => !isBotBlocked && setIsSearchOpen(true)}
                disabled={isBotBlocked}
              >
                우리 학교도 대박 투표하기
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 1위 학교 웅장하게 표시 */}
        {!rankingsLoading && rank1School && (
          <Card 
            className="border-none shadow-2xl bg-gradient-to-br from-primary/95 to-primary rounded-[2.5rem] overflow-hidden text-primary-foreground group cursor-pointer transition-transform hover:scale-[1.02]"
            onClick={() => !isBotBlocked && selectSchool({
              SD_SCHUL_CODE: rank1School.id,
              SCHUL_NM: rank1School.name,
              ATPT_OFCDC_SC_NM: rank1School.cityProvinceName,
              SCHUL_KND_SC_NM: rank1School.schoolKind,
              ATPT_OFCDC_SC_CODE: rank1School.atptCode || "",
              ORG_RDNMA: rank1School.address || "",
              ORG_TELNO: "",
              HMPG_ADRES: "",
              FOND_YMD: ""
            })}
          >
            <div className="p-8 space-y-4 relative">
              <div className="absolute top-6 right-8 opacity-20 group-hover:opacity-40 transition-opacity">
                <Crown className="h-24 w-24" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-tighter">Real-time #1</span>
                  <span className="text-[10px] font-bold opacity-80">{rank1School.cityProvinceName}</span>
                </div>
                <h2 className="text-4xl font-black headline tracking-tighter leading-tight drop-shadow-md">{rank1School.name}</h2>
              </div>
              <div className="pt-4 flex flex-col items-start gap-1">
                <span className="text-[10px] font-bold opacity-70 uppercase tracking-widest">누적 클릭 스코어</span>
                <span className="text-5xl font-black tabular-nums tracking-tighter">{(rank1School.score || 0).toLocaleString()}</span>
              </div>
            </div>
          </Card>
        )}

        <Card className="border-none shadow-sm bg-card rounded-3xl overflow-hidden border">
          <CardHeader className="py-4 px-6 border-b bg-secondary/10">
            <CardTitle className="text-sm font-bold flex items-center gap-2 headline">
              <Trophy className="h-4 w-4 text-primary" /> 학교 순위 TOP 10
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {rankingsLoading ? (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>
              ) : rankings.length > 0 ? (
                otherRankings.map((school: any, idx: number) => (
                  <div 
                    key={school.id} 
                    onClick={() => !isBotBlocked && selectSchool({
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
                    className={cn("flex items-center justify-between p-4 px-6 hover:bg-primary/5 transition-colors cursor-pointer group", isBotBlocked && "cursor-not-allowed")}
                  >
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        "w-6 text-center text-sm font-black tabular-nums",
                        idx === 0 ? "text-slate-400" : idx === 1 ? "text-amber-600" : "text-muted-foreground/40"
                      )}>
                        {idx + 2}
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
          onClick={() => !isBotBlocked && (isAdmin ? setIsAdminDialogOpen(true) : setIsLoginDialogOpen(true))}
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
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-bold uppercase tracking-widest">
                   <GraduationCap className="h-3 w-3" />
                  {currentRank ? `전국 실시간 ${currentRank}위` : '순위 진입 중...'}
                </div>
                <DialogTitle className="text-xl font-bold tracking-tight headline">{selectedSchool.SCHUL_NM}</DialogTitle>
                <div className="text-muted-foreground text-[10px]">
                  {selectedSchool.ATPT_OFCDC_SC_NM} • {selectedSchool.SCHUL_KND_SC_NM}
                </div>
              </div>

              <div className="px-8 py-4 text-center space-y-6">
                <div className="flex flex-col gap-1">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">누적 점수</div>
                  <div className="text-3xl font-black text-primary tabular-nums tracking-tighter">
                    {(currentSchoolServerData?.score || 0).toLocaleString()}
                  </div>
                </div>

                <div className="w-full">
                  <Button
                    onClick={() => handleButtonClick("normal")}
                    className="w-full h-20 text-3xl font-black rounded-3xl shadow-lg transition-all active:scale-[0.98] bg-primary/90 text-primary-foreground headline hover:bg-primary backdrop-blur-sm"
                  >
                    CLICK!
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="text-left space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                        <UtensilsCrossed className="h-3 w-3" /> 오늘의 급식
                      </div>
                      <Button 
                        size="sm" 
                        variant={hasDaebaked ? "secondary" : "outline"}
                        onClick={() => handleButtonClick("daebak")}
                        disabled={hasDaebaked}
                        className={cn(
                          "h-7 px-3 text-[10px] font-bold gap-1 rounded-full border transition-all",
                          hasDaebaked 
                            ? "bg-secondary text-muted-foreground border-transparent opacity-60 cursor-not-allowed" 
                            : "text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-900"
                        )}
                      >
                        <Star className={cn("h-3 w-3", hasDaebaked ? "fill-muted-foreground" : "fill-amber-500 text-amber-500")} /> 
                        {hasDaebaked ? "참여완료" : "대박!"}
                      </Button>
                    </div>
                    <div className="relative p-5 bg-primary/5 dark:bg-zinc-800/30 rounded-2xl border border-primary/10 min-h-[120px] flex flex-col justify-center overflow-hidden">
                      {isMealLoading ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="animate-spin h-5 w-5 text-primary/50" />
                          <span className="text-[10px] text-muted-foreground font-bold">로딩 중...</span>
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
                  <Button variant="outline" className="flex-1 rounded-xl h-11 font-bold border" onClick={handleKakaoShare}>
                    <Share2 className="h-4 w-4 mr-2" /> 카톡 공유
                  </Button>
                  <Button variant="ghost" className="px-4 rounded-xl h-11 opacity-40 font-bold" onClick={() => setIsClickModalOpen(false)}>닫기</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Anti-Bot Modal */}
      <Dialog open={isAntiBotOpen} onOpenChange={() => {}}>
        <DialogContent 
          className={cn("sm:max-w-[400px] rounded-3xl border-none shadow-2xl bg-card p-8 text-center", isBotBlocked && "pointer-events-auto")}
          onClick={() => {
            if (isBotBlocked) return;
            setSuspiciousClicks(prev => {
              const next = prev + 1;
              if (next >= 100) {
                setIsBotBlocked(true);
                toast({
                  variant: "destructive",
                  title: "비정상 활동 감지",
                  description: "서비스 이용이 제한되었습니다.",
                });
              }
              return next;
            });
          }}
        >
          {isBotBlocked ? (
            <div className="space-y-6">
              <div className="mx-auto p-4 bg-destructive/10 rounded-full w-fit">
                <ShieldAlert className="h-16 w-16 text-destructive" />
              </div>
              <DialogTitle className="text-3xl font-black text-destructive headline">접근 제한됨</DialogTitle>
              <DialogDescription className="text-base font-bold text-foreground pt-2">
                지나친 자동 클릭 시도가 감지되어 서비스 이용이 일시적으로 제한되었습니다. <br /><br />
                <span className="text-destructive font-black">브라우저를 새로고침 해주세요.</span>
              </DialogDescription>
            </div>
          ) : (
            <>
              <DialogHeader>
                <div className="mx-auto p-4 bg-primary/10 rounded-full w-fit mb-4">
                  <ShieldAlert className="h-10 w-10 text-primary animate-pulse" />
                </div>
                <DialogTitle className="text-2xl font-black tracking-tight headline">잠시 대기!</DialogTitle>
                <DialogDescription className="text-base font-bold text-foreground/80 pt-2">
                  비정상적으로 빠른 클릭이 감지되었습니다.<br />
                  혹시 <span className="text-primary underline underline-offset-4">로봇이 아닙니까?</span>
                  {suspiciousClicks > 0 && (
                    <div className="mt-4 p-2 bg-destructive/5 rounded-lg text-[10px] text-destructive font-black animate-bounce">
                      경고: 의심스러운 클릭 지속 감지 ({suspiciousClicks}/100)
                    </div>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-8">
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAntiBotConfirm();
                  }} 
                  className="w-full h-14 rounded-2xl text-lg font-black headline"
                >
                  로봇이 아닙니다
                </Button>
              </DialogFooter>
            </>
          )}
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
                  snap.forEach(d => batch.update(d.ref, { score: 0, daebakScore: 0 }));
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
              {rankings
                .filter(s => s.name.includes(adminSearchQuery))
                .map((school: any) => (
                <div key={school.id} className="flex items-center justify-between p-4 px-6">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">{school.name}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{school.score.toLocaleString()} clicks / {school.daebakScore?.toLocaleString() || 0} daebak</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-[10px]" onClick={() => setDoc(doc(db!, "schools", school.id), { daebakScore: 0 }, { merge: true })}>대박 리셋</Button>
                    <Button size="sm" variant="outline" className="h-8 text-destructive font-bold text-[10px]" onClick={() => setDoc(doc(db!, "schools", school.id), { score: 0 }, { merge: true })}>점수 리셋</Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
