
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
  Star, Crown, AlertTriangle, CheckCircle2,
  Smartphone, Trash2, RefreshCcw
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFirestore, useCollection, useAuth, useMemoFirebase, useUser } from "@/firebase";
import { doc, getDoc, increment, serverTimestamp, collection, query, orderBy, limit, getDocs, writeBatch, deleteDoc, setDoc } from "firebase/firestore";
import { signInAnonymously, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";

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

  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [suspiciousClicks, setSuspiciousClicks] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState<string>("");
  const [clientIp, setClientIp] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>("");
  const lastClickTimeRef = useRef<number>(0);
  const clickCountInSecondRef = useRef<number>(0);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [isResettingAll, setIsResettingAll] = useState(false);

  // Initialize Device ID and Check Ban
  useEffect(() => {
    let dId = localStorage.getItem("deviceId");
    if (!dId) {
      dId = crypto.randomUUID();
      localStorage.setItem("deviceId", dId);
    }
    setDeviceId(dId);

    const checkBanStatus = async (ip: string, id: string) => {
      if (!db) return;
      
      // 1. Check IP Ban
      const banRef = doc(db, "bans", ip);
      const banSnap = await getDoc(banRef).catch(() => null);
      if (banSnap?.exists()) {
        setIsBlocked(true);
        setBlockReason("IP 차단됨");
        return;
      }

      // 2. Check Device ID Ban
      const deviceBanRef = doc(db, "deviceBans", id);
      const deviceBanSnap = await getDoc(deviceBanRef).catch(() => null);
      if (deviceBanSnap?.exists()) {
        setIsBlocked(true);
        setBlockReason("기기 차단됨");
        return;
      }
    };

    const init = async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        setClientIp(data.ip);
        if (dId) await checkBanStatus(data.ip, dId);
      } catch (err) {
        console.error("Initialization check failed:", err);
      }
    };
    init();
  }, [db]);

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
    return query(collection(db, "schools"), orderBy("score", "desc"), limit(100));
  }, [db]);
  const { data: rankingsData, isLoading: rankingsLoading } = useCollection(rankingQuery);
  const rankings = useMemo(() => rankingsData || [], [rankingsData]);

  const bestMealQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "schools"), orderBy("daebakScore", "desc"), limit(1));
  }, [db]);
  const { data: bestMealSchoolData } = useCollection(bestMealQuery);
  const bestMealSchool = useMemo(() => bestMealSchoolData?.[0] || null, [bestMealSchoolData]);

  const flagsQuery = useMemoFirebase(() => {
    if (!db || !isAdmin) return null;
    return query(collection(db, "flags"), orderBy("flaggedAt", "desc"), limit(50));
  }, [db, isAdmin]);
  const { data: flaggedIps } = useCollection(flagsQuery);

  const bansQuery = useMemoFirebase(() => {
    if (!db || !isAdmin) return null;
    return query(collection(db, "bans"), orderBy("bannedAt", "desc"), limit(50));
  }, [db, isAdmin]);
  const { data: bannedIps } = useCollection(bansQuery);

  const deviceBansQuery = useMemoFirebase(() => {
    if (!db || !isAdmin) return null;
    return query(collection(db, "deviceBans"), orderBy("bannedAt", "desc"), limit(50));
  }, [db, isAdmin]);
  const { data: bannedDevices } = useCollection(deviceBansQuery);

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
    if (isBlocked) return;
    setSelectedSchool(school);
    setLocalClicks(0);
    setIsSearchOpen(false);
    setIsClickModalOpen(true);
  };

  const handleButtonClick = (type: "normal" | "daebak" = "normal") => {
    if (!selectedSchool || !db || isCoolingDown || isBlocked || !user) return;

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

      setDocumentNonBlocking(schoolRef, updateData, { merge: true });
    };

    if (window.grecaptcha && typeof window.grecaptcha.ready === 'function') {
      window.grecaptcha.ready(() => {
        window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'click' })
          .then(executeClick)
          .catch(() => executeClick());
      });
    } else {
      executeClick();
    }
  };

  const handleAntiBotConfirm = () => {
    if (isBlocked) return;
    setIsAntiBotOpen(false);
    setIsCoolingDown(false);
    setSuspiciousClicks(0);
    clickCountInSecondRef.current = 0;
    lastClickTimeRef.current = Date.now();
  };

  const handleKakaoShare = () => {
    if (isBlocked) return;
    if (!window.Kakao || !window.Kakao.isInitialized() || !selectedSchool) return;
    
    const score = currentSchoolServerData?.score || 0;
    const rankText = currentRank ? `전국 실시간 ${currentRank}위!` : '지금 바로 응원하세요!';
    
    try {
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: `SCHOOL CLICK: ${selectedSchool.SCHUL_NM}`,
          description: `누적 점수: ${score.toLocaleString()}점 | ${rankText}`,
          imageUrl: 'https://picsum.photos/seed/school/600/315',
          link: { mobileWebUrl: window.location.origin, webUrl: window.location.origin },
        },
        buttons: [{ title: '응원하러 가기', link: { mobileWebUrl: window.location.origin, webUrl: window.location.origin } }],
      });
    } catch (e) {
      console.error("Kakao Share Error:", e);
    }
  };

  const removeBan = async (ip: string) => {
    if (!db || !isAdmin) return;
    deleteDocumentNonBlocking(doc(db, "bans", ip));
    toast({ title: "차단 해제 요청됨", description: `${ip} IP 차단 해제를 시도합니다.` });
  };

  const removeDeviceBan = async (dId: string) => {
    if (!db || !isAdmin) return;
    deleteDocumentNonBlocking(doc(db, "deviceBans", dId));
    toast({ title: "기기 차단 해제 요청됨", description: "해당 기기의 차단 해제를 시도합니다." });
  };

  const approveBan = async (flag: any) => {
    if (!db || !isAdmin) return;
    
    const batch = writeBatch(db);
    
    if (flag.ip) {
      const banRef = doc(db, "bans", flag.ip);
      batch.set(banRef, { ip: flag.ip, bannedAt: serverTimestamp(), reason: flag.reason, uid: "admin" });
    }
    
    if (flag.deviceId) {
      const deviceBanRef = doc(db, "deviceBans", flag.deviceId);
      batch.set(deviceBanRef, { deviceId: flag.deviceId, bannedAt: serverTimestamp(), reason: flag.reason });
    }

    batch.delete(doc(db, "flags", flag.id));

    await batch.commit();
    toast({ title: "영구 차단 완료", description: "IP 및 기기 식별자가 모두 차단되었습니다." });
  };

  const dismissFlag = async (flagId: string) => {
    if (!db || !isAdmin) return;
    deleteDocumentNonBlocking(doc(db, "flags", flagId));
    toast({ title: "의심 해제 완료" });
  };

  const resetAllSchools = async () => {
    if (!db || !isAdmin) return;
    if (!confirm("정말 모든 학교의 점수를 리셋하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) return;

    setIsResettingAll(true);
    try {
      const q = query(collection(db, "schools"));
      const snapshot = await getDocs(q);
      const batchSize = 500;
      let count = 0;
      let batch = writeBatch(db);

      for (const docSnap of snapshot.docs) {
        batch.update(docSnap.ref, { score: 0, daebakScore: 0 });
        count++;
        if (count >= batchSize) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
      toast({ title: "리셋 완료", description: "모든 학교의 점수가 초기화되었습니다." });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "리셋 실패", description: "오류가 발생했습니다." });
    } finally {
      setIsResettingAll(false);
    }
  };

  return (
    <div className={cn("w-full min-h-screen flex flex-col bg-background text-foreground", isBlocked && "pointer-events-none")}>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => !isBlocked && window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <GraduationCap className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight headline">SCHOOL CLICK</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => !isBlocked && toggleTheme()} className="rounded-full">
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => !isBlocked && setIsAdminDialogOpen(true)} className="rounded-full text-primary">
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
            onClick={() => !isBlocked && setIsSearchOpen(true)}
            disabled={isBlocked}
            className="w-full h-14 text-base font-bold rounded-2xl border-2 hover:bg-primary/5 hover:border-primary/30 justify-start px-6 shadow-sm"
          >
            <Search className="mr-3 h-5 w-5 text-primary" /> 
            우리 학교를 검색해보세요
          </Button>
        </section>

        {bestMealSchool && (
          <Card className="border-none shadow-md bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-border/40">
            <CardHeader className="py-2 px-4 border-b bg-secondary/10 flex flex-row items-center justify-between">
              <CardTitle className="text-[10px] font-black flex items-center gap-1.5 text-amber-600 dark:text-amber-500 headline">
                <Star className="h-3 w-3 fill-amber-500" /> 오늘의 대박 급식
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex gap-4 items-center">
              <div 
                className="flex-1 space-y-1 cursor-pointer"
                onClick={() => selectSchool({
                  SD_SCHUL_CODE: bestMealSchool.id,
                  SCHUL_NM: bestMealSchool.name,
                  ATPT_OFCDC_SC_NM: bestMealSchool.cityProvinceName,
                  SCHUL_KND_SC_NM: bestMealSchool.schoolKind,
                  ATPT_OFCDC_SC_CODE: bestMealSchool.atptCode || "",
                  ORG_RDNMA: bestMealSchool.address || "",
                  ORG_TELNO: "", HMPG_ADRES: "", FOND_YMD: ""
                })}
              >
                <h2 className="text-lg font-black headline text-foreground tracking-tighter leading-tight hover:text-primary transition-colors">
                  {bestMealSchool.name}
                </h2>
                <p className="text-[10px] font-bold text-muted-foreground">{bestMealSchool.cityProvinceName}</p>
                <div className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest pt-1">
                  {bestMealSchool.daebakScore?.toLocaleString() || 0} DAEBAK
                </div>
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-primary font-bold text-[10px] hover:no-underline pt-1"
                  onClick={(e) => { e.stopPropagation(); setIsSearchOpen(true); }}
                >
                  우리 학교 투표하기 &rarr;
                </Button>
              </div>

              <div 
                className="flex-[1.2] p-4 bg-primary/5 dark:bg-zinc-800/30 rounded-xl border border-primary/10 min-h-[100px] flex flex-col justify-center cursor-pointer group hover:bg-primary/10 transition-colors"
                onClick={() => selectSchool({
                  SD_SCHUL_CODE: bestMealSchool.id,
                  SCHUL_NM: bestMealSchool.name,
                  ATPT_OFCDC_SC_NM: bestMealSchool.cityProvinceName,
                  SCHUL_KND_SC_NM: bestMealSchool.schoolKind,
                  ATPT_OFCDC_SC_CODE: bestMealSchool.atptCode || "",
                  ORG_RDNMA: bestMealSchool.address || "",
                  ORG_TELNO: "", HMPG_ADRES: "", FOND_YMD: ""
                })}
              >
                {isBestMealLoading ? (
                  <Loader2 className="animate-spin h-4 w-4 text-primary/50 mx-auto" />
                ) : (
                  <p className="text-[11px] font-bold text-foreground/80 leading-relaxed whitespace-pre-line text-center group-hover:text-primary transition-colors">
                    {bestMealInfo || "급식 정보를 불러올 수 없습니다."}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {rankings[0] && (
          <Card 
            className="border-none shadow-2xl bg-primary rounded-[2.5rem] overflow-hidden group cursor-pointer transition-transform hover:scale-[1.01]"
            onClick={() => !isBlocked && selectSchool({
              SD_SCHUL_CODE: rankings[0].id,
              SCHUL_NM: rankings[0].name,
              ATPT_OFCDC_SC_NM: rankings[0].cityProvinceName,
              SCHUL_KND_SC_NM: rankings[0].schoolKind,
              ATPT_OFCDC_SC_CODE: rankings[0].atptCode || "",
              ORG_RDNMA: rankings[0].address || "",
              ORG_TELNO: "", HMPG_ADRES: "", FOND_YMD: ""
            })}
          >
            <div className="p-8 space-y-4 relative">
              <div className="absolute top-6 right-8 opacity-10 group-hover:opacity-20 transition-opacity">
                <Crown className="h-24 w-24 text-white" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-tighter text-white">Real-time #1</span>
                </div>
                <h2 className="text-4xl font-black headline tracking-tighter leading-tight text-white">{rankings[0].name}</h2>
              </div>
              <div className="pt-4 flex flex-col items-start gap-1">
                <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">누적 클릭 스코어</span>
                <span className="text-5xl font-black tabular-nums tracking-tighter text-white">{(rankings[0].score || 0).toLocaleString()}</span>
              </div>
            </div>
          </Card>
        )}

        <Card className="border-none shadow-sm bg-card rounded-3xl overflow-hidden border">
          <CardHeader className="py-4 px-6 border-b bg-secondary/10">
            <CardTitle className="text-sm font-bold flex items-center gap-2 headline">
              <Trophy className="h-4 w-4 text-primary" /> 학교 순위 TOP 100
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div className="divide-y divide-border/30">
                {rankingsLoading ? (
                  <div className="flex justify-center p-12"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>
                ) : rankings.length > 0 ? (
                  rankings.map((school: any, idx: number) => (
                    <div 
                      key={school.id} 
                      onClick={() => !isBlocked && selectSchool({
                        SD_SCHUL_CODE: school.id,
                        SCHUL_NM: school.name,
                        ATPT_OFCDC_SC_NM: school.cityProvinceName,
                        SCHUL_KND_SC_NM: school.schoolKind,
                        ATPT_OFCDC_SC_CODE: school.atptCode || "",
                        ORG_RDNMA: school.address || "",
                        ORG_TELNO: "", HMPG_ADRES: "", FOND_YMD: ""
                      })}
                      className={cn("flex items-center justify-between p-4 px-6 hover:bg-primary/5 transition-colors cursor-pointer group", isBlocked && "cursor-not-allowed")}
                    >
                      <div className="flex items-center gap-4">
                        <span className={cn("w-8 text-center text-sm font-black tabular-nums", idx === 0 ? "text-primary" : "text-muted-foreground/40")}>{idx + 1}</span>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm group-hover:text-primary transition-colors">{school.name}</span>
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
            </ScrollArea>
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

      {/* Dialogs */}
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-card">
          <DialogHeader className="p-6 pb-0"><DialogTitle className="flex items-center gap-2 text-primary headline"><GraduationCap className="h-5 w-5" /> 학교 검색</DialogTitle></DialogHeader>
          <div className="p-6 space-y-4">
            <div className="relative">
              <Input placeholder="학교 이름을 입력하세요" value={searchKeyword} onChange={(e) => handleSearch(e.target.value)} className="pl-10 h-12 rounded-xl bg-secondary/10 border-none" />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/50" />
            </div>
            <ScrollArea className="h-[350px] -mx-2 px-2">
              <div className="space-y-1">
                {isSearching ? <Loader2 className="animate-spin h-8 w-8 text-primary mx-auto my-12" /> : searchResults.map((school, idx) => (
                  <button key={idx} onClick={() => selectSchool(school)} className="w-full text-left p-4 rounded-xl hover:bg-primary/5 flex items-center justify-between group">
                    <div className="flex flex-col">
                      <span className="font-bold text-base group-hover:text-primary">{school.SCHUL_NM}</span>
                      <span className="text-xs text-muted-foreground">{school.ATPT_OFCDC_SC_NM}</span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isClickModalOpen} onOpenChange={setIsClickModalOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl bg-card">
          {selectedSchool && (
            <div className="flex flex-col">
              <div className="p-8 pb-4 text-center space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-bold uppercase tracking-widest">
                  {currentRank ? `전국 실시간 ${currentRank}위` : '순위 진입 중...'}
                </div>
                <DialogTitle className="text-xl font-bold tracking-tight headline">{selectedSchool.SCHUL_NM}</DialogTitle>
                <div className="text-muted-foreground text-[10px]">{selectedSchool.ATPT_OFCDC_SC_NM}</div>
              </div>
              <div className="px-8 py-4 text-center space-y-6">
                <div className="text-3xl font-black text-primary tabular-nums tracking-tighter">{(currentSchoolServerData?.score || 0).toLocaleString()}</div>
                <Button onClick={() => handleButtonClick("normal")} className="w-full h-20 text-3xl font-black rounded-3xl shadow-lg transition-all active:scale-[0.98] bg-primary/90 text-primary-foreground headline hover:bg-primary">CLICK!</Button>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-bold text-primary flex items-center gap-1.5"><UtensilsCrossed className="h-3 w-3" /> 오늘의 급식</div>
                    <Button size="sm" variant={hasDaebaked ? "secondary" : "outline"} onClick={() => handleButtonClick("daebak")} disabled={hasDaebaked} className="h-7 px-3 text-[10px] font-bold gap-1 rounded-full border">
                      <Star className={cn("h-3 w-3", hasDaebaked ? "fill-muted-foreground" : "fill-amber-500 text-amber-500")} /> {hasDaebaked ? "참여완료" : "대박!"}
                    </Button>
                  </div>
                  <div className="p-5 bg-primary/5 dark:bg-zinc-800/30 rounded-2xl border border-primary/10 min-h-[120px] flex flex-col justify-center">
                    {isMealLoading ? <Loader2 className="animate-spin h-5 w-5 text-primary/50 mx-auto" /> : <p className="text-sm font-bold text-foreground/80 leading-relaxed whitespace-pre-line text-center">{mealInfo}</p>}
                  </div>
                </div>
                <div className="flex gap-2 pb-6">
                  <Button variant="outline" className="flex-1 rounded-xl h-11 font-bold border" onClick={handleKakaoShare}><Share2 className="h-4 w-4 mr-2" /> 카톡 공유</Button>
                  <Button variant="ghost" className="px-4 rounded-xl h-11 opacity-40 font-bold" onClick={() => setIsClickModalOpen(false)}>닫기</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAntiBotOpen} onOpenChange={() => {}}>
        <DialogContent 
          className={cn("sm:max-w-[400px] rounded-3xl border-none shadow-2xl bg-card p-8 text-center", isBlocked && "pointer-events-auto")}
          onClick={() => {
            if (isBlocked || !db) return;
            setSuspiciousClicks(prev => {
              const next = prev + 1;
              if (next >= 100) {
                const flagRef = doc(collection(db, "flags"));
                setDocumentNonBlocking(flagRef, {
                  id: flagRef.id,
                  ip: clientIp,
                  deviceId: deviceId,
                  flaggedAt: serverTimestamp(),
                  reason: "high_frequency_click",
                  clickCount: next,
                  uid: user?.uid || "anonymous"
                }, { merge: true });
                toast({ variant: "destructive", title: "활동 감지됨", description: "관리자 검토가 시작됩니다." });
              }
              return next;
            });
          }}
        >
          {isBlocked ? (
            <div className="space-y-6">
              <div className="mx-auto p-4 bg-destructive/10 rounded-full w-fit"><ShieldAlert className="h-16 w-16 text-destructive" /></div>
              <DialogTitle className="text-3xl font-black text-destructive headline">접근 제한됨</DialogTitle>
              <DialogDescription className="text-base font-bold text-foreground pt-2">비정상 활동으로 이용이 제한되었습니다. ({blockReason})</DialogDescription>
            </div>
          ) : (
            <>
              <DialogHeader>
                <div className="mx-auto p-4 bg-primary/10 rounded-full w-fit mb-4"><ShieldAlert className="h-10 w-10 text-primary animate-pulse" /></div>
                <DialogTitle className="text-2xl font-black headline">잠시 대기!</DialogTitle>
                <DialogDescription className="text-base font-bold text-foreground/80 pt-2" asChild>
                  <span>
                    비정상적으로 빠른 클릭이 감지되었습니다.<br />
                    혹시 <span className="text-primary underline underline-offset-4">로봇이 아닙니까?</span>
                    {suspiciousClicks > 0 && (
                      <span className="block mt-4 p-2 bg-destructive/5 rounded-lg text-[10px] text-destructive font-black animate-bounce">
                        경고: 의심스러운 활동 지속 감지 ({suspiciousClicks}/100)
                      </span>
                    )}
                  </span>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="mt-8"><Button onClick={handleAntiBotConfirm} className="w-full h-14 rounded-2xl text-lg font-black headline">로봇이 아닙니다</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

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
            <Button type="submit" className="w-full rounded-xl h-12 font-bold" disabled={isLoggingIn}>{isLoggingIn ? <Loader2 className="animate-spin" /> : "로그인"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAdminDialogOpen} onOpenChange={setIsAdminDialogOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-card">
          <DialogHeader className="p-6 bg-primary/10 flex flex-row items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-primary headline"><Settings className="h-5 w-5" /> 관리자 센터</DialogTitle>
            <Button variant="ghost" size="sm" onClick={() => { signOut(auth!); setIsAdminDialogOpen(false); }} className="text-destructive"><LogOut className="h-4 w-4" /></Button>
          </DialogHeader>
          
          <Tabs defaultValue="schools" className="w-full">
            <TabsList className="w-full grid grid-cols-4 rounded-none">
              <TabsTrigger value="schools" className="text-[10px] font-bold">학교</TabsTrigger>
              <TabsTrigger value="flags" className="text-[10px] font-bold">의심 ({flaggedIps?.length || 0})</TabsTrigger>
              <TabsTrigger value="bans" className="text-[10px] font-bold">IP</TabsTrigger>
              <TabsTrigger value="deviceBans" className="text-[10px] font-bold">기기</TabsTrigger>
            </TabsList>
            
            <TabsContent value="schools" className="m-0">
              <div className="p-4 border-b bg-secondary/5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">학교 점수 관리</span>
                <Button 
                  size="sm" 
                  variant="destructive" 
                  className="h-8 text-[10px] font-bold gap-1.5" 
                  disabled={isResettingAll}
                  onClick={resetAllSchools}
                >
                  {isResettingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
                  전체 학교 점수 리셋
                </Button>
              </div>
              <ScrollArea className="h-[400px]">
                <div className="divide-y">
                  {rankings.map((school: any) => (
                    <div key={school.id} className="flex items-center justify-between p-4 px-6">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">{school.name}</span>
                        <span className="text-[10px] text-muted-foreground">{school.score?.toLocaleString() || 0} pts</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 text-destructive font-bold text-[10px]" 
                        onClick={() => setDocumentNonBlocking(doc(db!, "schools", school.id), { score: 0, daebakScore: 0 }, { merge: true })}
                      >
                        리셋
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="flags" className="m-0">
              <ScrollArea className="h-[400px]">
                <div className="divide-y">
                  {flaggedIps?.map((flag: any) => (
                    <div key={flag.id} className="p-4 px-6 space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-primary">{flag.ip}</span>
                          <span className="text-[9px] text-muted-foreground font-mono">{flag.deviceId}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-[9px]" onClick={() => dismissFlag(flag.id)}>해제</Button>
                          <Button size="sm" variant="destructive" className="h-7 text-[9px]" onClick={() => approveBan(flag)}>차단</Button>
                        </div>
                      </div>
                      <div className="text-[9px] bg-secondary/30 p-2 rounded">Reason: {flag.reason} | Clicks: {flag.clickCount}</div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="bans" className="m-0">
              <ScrollArea className="h-[400px]">
                <div className="divide-y">
                  {bannedIps?.map((ban: any) => (
                    <div key={ban.id} className="flex items-center justify-between p-4 px-6">
                      <span className="text-xs font-bold">{ban.ip}</span>
                      <Button size="sm" variant="outline" className="h-7 text-[9px]" onClick={() => removeBan(ban.ip)}>해제</Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="deviceBans" className="m-0">
              <ScrollArea className="h-[400px]">
                <div className="divide-y">
                  {bannedDevices?.map((ban: any) => (
                    <div key={ban.id} className="flex items-center justify-between p-4 px-6">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-mono text-muted-foreground">{ban.deviceId}</span>
                        <span className="text-[8px]">{ban.bannedAt?.toDate().toLocaleString()}</span>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-[9px]" onClick={() => removeDeviceBan(ban.deviceId)}>해제</Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <footer className="w-full py-10 text-center border-t mt-auto bg-secondary/10">
        <button onClick={() => !isBlocked && (isAdmin ? setIsAdminDialogOpen(true) : setIsLoginDialogOpen(true))} className="text-[10px] font-bold text-muted-foreground tracking-widest opacity-30 hover:opacity-100 transition-opacity">
          ©2026 SCHOOL CLICK | Device: {deviceId.substring(0, 8)}...
        </button>
      </footer>
    </div>
  );
}
