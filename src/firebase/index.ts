
'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore'

// SDK 인스턴스를 캐싱하여 중복 초기화로 인한 내부 상태 오류(Assertion Failed)를 방지합니다.
let cachedSdks: {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
} | null = null;

export function initializeFirebase() {
  if (cachedSdks) return cachedSdks;

  let firebaseApp: FirebaseApp;

  if (!getApps().length) {
    try {
      // Firebase App Hosting 환경 변수를 통한 자동 초기화 시도
      firebaseApp = initializeApp();
    } catch (e) {
      if (process.env.NODE_ENV === "production") {
        console.warn('Automatic initialization failed. Falling back to firebase config object.', e);
      }
      firebaseApp = initializeApp(firebaseConfig);
    }
  } else {
    firebaseApp = getApp();
  }

  cachedSdks = {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };

  return cachedSdks;
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
