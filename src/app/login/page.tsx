'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (searchParams.get('error') === 'deactivated') {
      setError('Your account has been deactivated. Please contact your administrator.')
      const supabase = createClient()
      supabase.auth.signOut()
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (mode === 'forgot') {
      try {
        const res = await fetch('/api/agents/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), name: email.split('@')[0], mode: 'forgot' }),
        })
        const contentType = res.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json()
          if (res.ok) {
            setSuccess(`Password reset link sent to ${email}. Please check your inbox!`)
          } else {
            setError(data.error || 'Failed to send password reset email')
          }
        } else {
          setError('Unexpected server response. Please try again.')
        }
      } catch (err: any) {
        setError(err?.message || 'Error sending password reset link')
      }
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('Invalid email or password')
      setLoading(false)
      return
    }

    if (authData?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', authData.user.id)
        .single()

      if (profile && profile.is_active === false) {
        await supabase.auth.signOut()
        setError('Your account has been deactivated. Please contact your administrator.')
        setLoading(false)
        return
      }
    }

    const targetUrl = redirectTo.startsWith('/') ? redirectTo : '/dashboard'
    router.push(targetUrl)
    router.refresh()
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 32,
          }}
        >
          <img
            src="/Adonix X Logo.jpeg"
            alt="Adonix Logo"
            style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }}
          />
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
              Adonix CRM
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Meta Ads & Leads Platform
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div style={{ marginBottom: 20 }}>
              <h1
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 4,
                }}
              >
                {mode === 'login' ? 'Sign in' : 'Reset password'}
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {mode === 'login'
                  ? 'Enter your email and password to continue'
                  : 'Enter your registered email to receive a password reset link'}
              </p>
            </div>

            {success ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: '12px 14px', background: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: 'var(--radius-sm)', color: 'var(--success)', fontSize: 13 }}>
                  {success}
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => { setMode('login'); setSuccess(''); setError('') }}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Back to Sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    className={`form-input ${error ? 'error' : ''}`}
                    placeholder="you@adonix.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                {mode === 'login' && (
                  <div className="form-group">
                    <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
                      <label className="form-label form-label-required" htmlFor="password" style={{ marginBottom: 0 }}>
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent)',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        className={`form-input ${error ? 'error' : ''}`}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        style={{ paddingRight: 40 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-tertiary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0,
                        }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                >
                  {loading ? (
                    <>
                      <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                      {mode === 'login' ? 'Signing in...' : 'Sending link...'}
                    </>
                  ) : mode === 'login' ? (
                    'Sign in'
                  ) : (
                    'Send reset password link'
                  )}
                </button>

                {mode === 'forgot' && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                    style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
                  >
                    Cancel and return to Sign in
                  </button>
                )}
              </form>
            )}
          </div>
        </div>

        <p
          style={{
            marginTop: 24,
            fontSize: 12,
            color: 'var(--text-tertiary)',
            textAlign: 'center',
          }}
        >
          Internal platform — contact your admin for access
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
      <LoginForm />
    </Suspense>
  )
}
