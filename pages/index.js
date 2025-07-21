// pages/index.js
import { useEffect, useState } from 'react'
import { auth, db } from '@/utils/firebase'
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from 'firebase/auth'
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  getDoc
} from 'firebase/firestore'

export default function Home() {
  const [user, setUser] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [startTime, setStartTime] = useState(null)
  const [paused, setPaused] = useState(false)
  const [pauses, setPauses] = useState([])
  const [elapsed, setElapsed] = useState(0)
  const [sessions, setSessions] = useState([])

  // ⏱️ Contador en tiempo real
  useEffect(() => {
    let interval
    if (startTime && !paused) {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [startTime, paused])

  // 👤 Autenticación
  useEffect(() => {
    return onAuthStateChanged(auth, user => setUser(user))
  }, [])

  // 🔁 Historial de sesiones
  useEffect(() => {
    if (!user) return
    const ref = collection(db, 'users', user.uid, 'sessions')
    const unsub = onSnapshot(ref, snap => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setSessions(data.sort((a, b) => b.start?.seconds - a.start?.seconds))
    })
    return () => unsub()
  }, [user])

  const startSession = async () => {
    const ref = await addDoc(collection(db, 'users', user.uid, 'sessions'), {
      start: serverTimestamp(),
      pauses: []
    })
    setSessionId(ref.id)
    setStartTime(new Date())
    setPaused(false)
    setPauses([])
    setElapsed(0)
  }

  const pauseSession = () => {
    if (!paused) {
      setPaused(true)
      setPauses([...pauses, { start: new Date() }])
    } else {
      const updated = [...pauses]
      updated[updated.length - 1].end = new Date()
      setPauses(updated)
      setPaused(false)
    }
  }

  const endSession = async () => {
    if (!sessionId || !startTime) return
    const ref = doc(db, 'users', user.uid, 'sessions', sessionId)
    await updateDoc(ref, {
      end: serverTimestamp(),
      pauses
    })
    setSessionId(null)
    setStartTime(null)
    setPaused(false)
    setElapsed(0)
    setPauses([])
  }

  const formatTime = (sec) =>
      new Date(sec * 1000).toISOString().substring(11, 19)

  const signIn = () => signInWithPopup(auth, new GoogleAuthProvider())
  const logout = () => signOut(auth)

  return (
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        {!user ? (
            <button onClick={signIn}>Iniciar sesión con Google</button>
        ) : (
            <>
              <p>
                Bienvenido, {user.displayName}{' '}
                <button onClick={logout}>Cerrar sesión</button>
              </p>

              <h1 style={{ fontSize: '3rem' }}>{formatTime(elapsed)}</h1>

              {!startTime ? (
                  <button onClick={startSession}>Iniciar</button>
              ) : (
                  <>
                    <button onClick={pauseSession}>
                      {paused ? 'Reanudar' : 'Pausar'}
                    </button>
                    <button onClick={endSession}>Salir</button>
                  </>
              )}

              <h2>Historial</h2>
              <ul>
                {sessions.map((s) => (
                    <li key={s.id} style={{ marginBottom: '1rem' }}>
                      🟢 Inicio:{' '}
                      {s.start?.toDate().toLocaleString() || '...'}
                      <br />
                      🔴 Fin: {s.end?.toDate().toLocaleString() || 'En curso'}
                      <br />
                      ⏸️ Pausas: {s.pauses?.length || 0}
                    </li>
                ))}
              </ul>
            </>
        )}
      </main>
  )
}
