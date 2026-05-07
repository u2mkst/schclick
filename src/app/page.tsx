
'use client';

import { SchoolClicker } from "@/components/SchoolClicker";
import { FirebaseClientProvider } from "@/firebase";
import { initializeFirebase } from "@/firebase";
import { useMemo } from "react";

export default function Home() {
  const { firebaseApp, firestore, auth } = useMemo(() => initializeFirebase(), []);

  return (
    <FirebaseClientProvider firebaseApp={firebaseApp} firestore={firestore} auth={auth}>
      <main className="min-h-screen p-4 md:p-8">
        <SchoolClicker />
      </main>
    </FirebaseClientProvider>
  );
}
