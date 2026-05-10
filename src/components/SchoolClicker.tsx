"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { searchSchools, type School } from "@/lib/neis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Search, Trophy, Loader2, MapPin, 
  Phone, Link as LinkIcon, Calendar, GraduationCap, 
  Moon, Sun, Settings, RotateCcw, X, AlertCircle,
  MousePointer2, Globe, BadgeInfo, LogOut, Key, Trash2,
  Share2
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

declare global {
  interface Window {
    kakao: any;
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

  // 비정상 클릭 감지용 상태
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const lastClickTimeRef = useRef<number>(0);
  const clickCountInSecondRef = useRef<number>(0);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [isResettingAll, setIsResettingAll] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 테마 설정 로드
    const savedTheme = localStorage.getItem("theme");
    const themeIsDark = savedTheme === "dark";
    setIsDark(themeIsDark);
    if (themeIsDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // 로컬 클릭 수 로드
    const savedClicks = localStorage.getItem("myTotalClicks");
    if (savedClicks) {
      setMyTotalClicks(parseInt(savedClicks, 10));
    }

    // Kakao SDK 초기화
    const initKakao = () => {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        try {
          window.Kakao.init(KAKAO_KEY);
        } catch (e) {
          console.warn("Kakao init error", e);
        }
      }
    };
    
    const timer = setTimeout(initKakao, 2000);
    return () => clearTimeout(timer);
  }, []);

  // 익명 로그인 유지
  useEffect(() => {
    if (auth && !isUserLoading && !user) {
      signInAnonymously(auth).catch(() => {});
    }
  }, [auth, user, isUserLoading]);

  // 카카오맵 로드 로직
  useEffect(() => {
    if (isClickModalOpen && selectedSchool && mapContainerRef.current) {
      const loadMap = () => {
        if (!window.kakao || !window.kakao.maps) {
          return;
        }
        
        try {
          window.kakao.maps.load(() => {
            const geocoder = new window.kakao.maps.services.Geocoder();
            geocoder.addressSearch(selectedSchool.ORG_RDNMA, (result: any, status: any) => {
              if (status === window.kakao.maps.services.Status.OK && mapContainerRef.current) {
                const coords = new window.kakao.maps.LatLng(result[0].y, result[0].x);
                const options = {
                  center: coords,
                  level: 3
                };
                const map = new window.kakao.maps.Map(mapContainerRef.current, options);
                new window.kakao.maps.Marker({
                  map: map,
                  position: coords
                });
              }
            });
          });
        } catch (e) {
          console.error("Map loading error:", e);
        }
      };

      const timer = setTimeout(loadMap, 800);
      return () => clearTimeout(timer);
    }
  }, [isClickModalOpen, selectedSchool]);

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
    const list = allManagedSchools;
    if (!adminSearchQuery) return list.slice(0, 10);
    return list.filter(s => s.name.includes(adminSearchQuery));
  }, [allManagedSchools, adminSearchQuery]);

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
    if (!selectedSchool || !db || isCoolingDown) return;

    // 비정상 클릭 속도 감지
    const now = Date.now();
    if (now - lastClickTimeRef.current < 1000) {
      clickCountInSecondRef.current += 1;
      if (clickCountInSecondRef.current > 15) {
        setIsCoolingDown(true);
        toast({
          variant: "destructive",
          title: "비정상 클릭 감지",
          description: "잠시 후 다시 시도해주세요. (자동 클릭 방지)",
        });
        setTimeout(() => {
          setIsCoolingDown(false);
          clickCountInSecondRef.current = 0;
        }, 3000);
        return;
      }
    } else {
      clickCountInSecondRef.current = 1;
      lastClickTimeRef.current = now;
    }

    const executeClick = () => {
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

    // reCAPTCHA v3
    if (window.grecaptcha && window.grecaptcha.ready) {
      window.grecaptcha.ready(() => {
        window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'click' })
          .then((token: string) => {
            if (token) {
              executeClick();
            }
          })
          .catch(() => {
            executeClick();
          });
      });
    } else {
      executeClick();
    }
  };

  const handleKakaoShare = () => {
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      try {
        window.Kakao.init(KAKAO_KEY);
      } catch(e) {
        toast({ variant: "destructive", title: "공유 실패", description: "카카오 서비스를 사용할 수 없습니다." });
        return;
      }
    }
    
    if (!selectedSchool) return;

    const score = currentSchoolServerData?.score || 0;
    const rankText = currentRank ? `전국 ${currentRank}위!` : '지금 바로 응원하세요!';

    try {
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: selectedSchool.SCHUL_NM,
          description: `누적 점수: ${score.toLocaleString()}점 | ${rankText}`,
          imageUrl: 'https://picsum.photos/seed/school/600/300',
          link: {
            mobileWebUrl: window.location.origin,
            webUrl: window.location.origin,
          },
        },
        buttons: [
          {
            title: '응원하러 가기',
            link: {
              mobileWebUrl: window.location.origin,
              webUrl: window.location.origin,
            },
          },
        ],
      });
    } catch (e) {
      toast({ variant: "destructive", title: "공유 실패", description: "오류가 발생했습니다." });
    }
  };

  const handleResetScore = (schoolId: string) => {
    if (!db || !isAdmin) return;
    const confirmReset = confirm("정말로 이 학교의 점수를 초기화하시겠습니까?");
    if (!confirmReset) return;

    const schoolRef = doc(db, "schools", schoolId);
    setDoc(schoolRef, { score: 0, updatedAt: serverTimestamp() }, { merge: true });
  };

  const handleResetAllScores = async () => {
    if (!db || !isAdmin) return;
    const confirmReset = confirm("전체 학교의 점수를 초기화하시겠습니까?");
    if (!confirmReset) return;

    setIsResettingAll(true);
    try {
      const querySnapshot = await getDocs(collection(db, "schools"));
      const batch = writeBatch(db);
      querySnapshot.forEach((doc) => {
        batch.update(doc.ref, { score: 0, updatedAt: serverTimestamp() });
      });
      await batch.commit();
      toast({ title: "전체 초기화 완료" });
    } catch (error) {
      toast({ variant: "destructive", title: "초기화 실패" });
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
      toast({ title: "관리자 로그인 성공" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "로그인 실패", description: "계정 정보를 확인해주세요." });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    setIsAdminDialogOpen(false);
    toast({ title: "로그아웃 되었습니다." });
  };

  return (
    <div className="w-full min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <GraduationCap className="h-6 w-6 text-primary" />
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
            className="w-full h-14 text-base font-bold rounded-2xl border-2 hover:bg-primary/5 hover:border-primary/30 justify-start px-6 shadow-sm"
          >
            <Search className="mr-3 h-5 w-5 text-primary" /> 
            우리 학교를 검색해보세요
          </Button>
        </section>

        <Card className="border-none shadow-sm bg-card rounded-3xl overflow-hidden border">
          <CardHeader className="py-4 px-6 border-b bg-secondary/10">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
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
                    onClick={() => selectSchoolFromRanking(school)}
                    className="flex items-center justify-between p-4 px-6 hover:bg-primary/5 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        "w-6 text-center text-sm font-black",
                        idx === 0 ? "text-yellow-500 text-lg" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-amber-600" : "text-muted-foreground/40"
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

      <footer className="w-full py-10 text-center border-t mt-12 bg-secondary/10">
        <button 
          onClick={() => isAdmin ? setIsAdminDialogOpen(true) : setIsLoginDialogOpen(true)}
          className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-30 hover:opacity-100 transition-opacity"
        >
          ©2026 KST
        </button>
      </footer>

      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-card">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2 text-primary">
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
                autoFocus
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/50" />
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
                      className="w-full text-left p-4 rounded-xl hover:bg-primary/5 transition-all flex items-center justify-between group"
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base group-hover:text-primary transition-colors">{school.SCHUL_NM}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded-md font-bold">
                            {school.SCHUL_KND_SC_NM}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">{school.ATPT_OFCDC_SC_NM}</span>
                      </div>
                      <GraduationCap className="h-4 w-4 opacity-0 group-hover:opacity-100 text-primary transition-all" />
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

      <Dialog open={isClickModalOpen} onOpenChange={setIsClickModalOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl bg-card">
          {selectedSchool && (
            <div className="flex flex-col max-h-[90vh] overflow-y-auto">
              <div className="p-8 pb-4 text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">
                   <GraduationCap className="h-3 w-3" />
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

              <div className="px-8 py-4 text-center space-y-6">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">총 누적 점수</div>
                  <div className="text-5xl font-black text-primary tabular-nums tracking-tighter">
                    {(currentSchoolServerData?.score || 0).toLocaleString()}
                  </div>
                </div>

                <div className="relative group">
                  <Button
                    onClick={handleButtonClick}
                    disabled={isCoolingDown}
                    className={cn(
                      "w-full h-24 text-3xl font-black rounded-[2rem] shadow-xl transition-all active:scale-[0.96] text-primary-foreground",
                      isCoolingDown ? "bg-muted cursor-not-allowed" : "bg-primary hover:bg-primary/90"
                    )}
                  >
                    {isCoolingDown ? "잠시 대기..." : "CLICK!"}
                  </Button>
                  {isCoolingDown && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <AlertCircle className="h-10 w-10 text-destructive animate-bounce" />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="text-left space-y-2">
                    <div className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> 학교 위치 (지도)
                    </div>
                    <div 
                      ref={mapContainerRef} 
                      className="w-full h-40 rounded-2xl bg-secondary/30 overflow-hidden border border-border/30"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <InfoItem icon={<Phone className="h-3 w-3" />} label="전화" value={selectedSchool.ORG_TELNO} />
                    <InfoItem icon={<LinkIcon className="h-3 w-3" />} label="웹사이트" value={selectedSchool.HMPG_ADRES} isLink />
                    <InfoItem icon={<Calendar className="h-3 w-3" />} label="설립일" value={formatDate(selectedSchool.FOND_YMD)} />
                  </div>
                </div>

                <div className="flex gap-2 pb-6">
                  <Button 
                    variant="outline" 
                    className="flex-1 rounded-2xl h-12 font-bold border-2"
                    onClick={handleKakaoShare}
                  >
                    <Share2 className="h-4 w-4 mr-2" /> 카톡 공유
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="px-4 rounded-2xl h-12 opacity-40 hover:opacity-100"
                    onClick={() => setIsClickModalOpen(false)}
                  >
                    닫기
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl border-none shadow-2xl bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Key className="h-5 w-5" /> 관리자 로그인
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdminLogin} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">이메일</label>
              <Input 
                type="email" 
                placeholder="admin@example.com" 
                value={loginEmail} 
                onChange={(e) => setLoginEmail(e.target.value)} 
                className="rounded-xl bg-secondary/10 border-none"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">비밀번호</label>
              <Input 
                type="password" 
                placeholder="••••••••" 
                value={loginPassword} 
                onChange={(e) => setLoginPassword(e.target.value)} 
                className="rounded-xl bg-secondary/10 border-none"
                required
              />
            </div>
            <Button type="submit" className="w-full rounded-xl h-12 font-bold" disabled={isLoggingIn}>
              {isLoggingIn ? <Loader2 className="animate-spin h-5 w-5" /> : "로그인"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAdminDialogOpen} onOpenChange={setIsAdminDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-card">
          <DialogHeader className="p-6 bg-primary/10 flex flex-row items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-primary">
              <Settings className="h-5 w-5" /> 관리자 센터
            </DialogTitle>
            <div className="flex items-center gap-2">
               <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleResetAllScores} 
                disabled={isResettingAll}
                className="text-[10px] h-8"
              >
                {isResettingAll ? "초기화 중..." : "전체 초기화"}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs font-bold text-destructive">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </DialogHeader>
          <div className="p-4 border-b bg-secondary/5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
              <Input 
                placeholder="관리할 학교 검색" 
                value={adminSearchQuery}
                onChange={(e) => setAdminSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-xl bg-background border-border"
              />
            </div>
          </div>
          <div className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="divide-y divide-border/20">
                {filteredAdminSchools.map((school: any) => (
                  <div key={school.id} className="flex items-center justify-between p-4 px-6 hover:bg-secondary/10">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{school.name}</span>
                      <span className="text-[10px] text-muted-foreground">{school.score || 0} clicks</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 text-[10px] text-destructive"
                      onClick={() => handleResetScore(school.id)}
                    >
                      리셋
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoItem({ icon, label, value, isLink }: { icon: any, label: string, value: string, isLink?: boolean }) {
  if (!value || value === "정보 없음" || value === " ") return null;
  const linkHref = value.startsWith('http') ? value : `http://${value}`;
  
  return (
    <div className="p-3 bg-secondary/30 rounded-2xl space-y-1 text-left overflow-hidden border border-transparent">
      <div className="flex items-center gap-1.5 text-[9px] font-black text-muted-foreground uppercase tracking-wider">
        {icon} {label}
      </div>
      <div className="text-[10px] font-bold truncate">
        {isLink ? (
          <a href={linkHref} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            방문하기
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
