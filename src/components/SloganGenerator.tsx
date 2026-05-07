"use client";

import { useState } from "react";
import { generateSchoolSlogan } from "@/ai/flows/ai-school-slogan-tool";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

interface SloganGeneratorProps {
  schoolName: string;
}

export function SloganGenerator({ schoolName }: SloganGeneratorProps) {
  const [slogan, setSlogan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!schoolName || loading) return;
    setLoading(true);
    try {
      const result = await generateSchoolSlogan({ schoolName });
      setSlogan(result.slogan);
    } catch (error) {
      console.error("AI Slogan Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 p-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center gap-3">
      {slogan ? (
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-1">AI가 추천하는 우리 학교 슬로건</p>
          <p className="text-lg font-bold text-primary italic">"{slogan}"</p>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleGenerate}
            className="mt-2 text-xs opacity-60 hover:opacity-100"
          >
            {loading ? <Loader2 className="animate-spin h-3 w-3 mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
            다시 생성
          </Button>
        </div>
      ) : (
        <Button 
          variant="outline" 
          onClick={handleGenerate} 
          disabled={loading}
          className="w-full bg-transparent border-primary/30 hover:bg-primary/20 text-primary-foreground"
        >
          {loading ? (
            <Loader2 className="animate-spin h-4 w-4 mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          학교 슬로건 생성하기
        </Button>
      )}
    </div>
  );
}
