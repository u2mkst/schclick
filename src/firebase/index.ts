
'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore'

// Next.js 개발 환경(HMR)에서 인스턴스 유지를 위해 전역 객체 키 정의
const GLOBAL_FIREBASE_KEY = '__FIREBASE_SDKS_SINGLETON__';

export function initializeFirebase() {
  // 브라우저 환경에서 이미 초기화된 인스턴스가 전역에 존재하면 이를 반환 (HMR 대응)
  if (typeof window !== 'undefined' && (window as any)[GLOBAL_FIREBASE_KEY]) {
    return (window as any)[GLOBAL_FIREBASE_KEY];
  }

  let firebaseApp: FirebaseApp;

  // 이미 초기화된 앱이 있는지 확인하여 중복 initializeApp 호출 방지
  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
  } else {
    try {
      // Firebase Studio 환경의 기본 설정으로 앱 초기화
      firebaseApp = initializeApp(firebaseConfig);
    } catch (e) {
      // 예외 발생 시 기존 앱 인스턴스 획득 시도
      firebaseApp = getApp();
    }
  }

  const sdks = {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };

  // 브라우저 전역 객체에 인스턴스 캐싱
  if (typeof window !== 'undefined') {
    (window as any)[GLOBAL_FIREBASE_KEY] = sdks;
  }

  return sdks;
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
