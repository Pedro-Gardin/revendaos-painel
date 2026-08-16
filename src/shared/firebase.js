// =============================================
//  Inicialização única do Firebase.
//  Qualquer módulo que precise do db/auth
//  importa daqui — nunca chama initializeApp de novo.
// =============================================
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from './firebase-config.js';

export const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);
