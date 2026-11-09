'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { showToast } from '@/components/toast';
import { formatKazakhstanAuthPhone, normalizeKazakhstanLocalPhoneInput } from '@/lib/core/auth/phone-input';
import { getMessages, resolveLocale } from '@/lib/i18n';

// 鉴权流程(真实后端 /api/v1/auth/*):登录 / 注册 / 短信验证码 / 找回密码。
// sandbox 阶段后端把验证码随响应回传(debugCode),在验证码屏显示提示;接真实短信后不再回传。
// 成功后后端种 HttpOnly session cookie;同时写 localStorage aman_auth 供创建页拦截门快速判断。
type Mode = 'login' | 'register' | 'recover';
type Step = 'phone' | 'otp' | 'newpass' | 'account';
const PASSWORD_MIN = 4;
const PASSWORD_MAX = 20;

function setLoggedIn() {
  try {
    localStorage.setItem('aman_auth', '1');
  } catch {
    /* 忽略 */
  }
}

export function AuthFlow({ locale, mode }: { locale: string; mode: Mode }) {
  const cl = resolveLocale(locale);
  const msgs = getMessages(cl);
  const t = msgs.auth;
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [step, setStep] = useState<Step>('phone');
  const [code, setCode] = useState(['', '', '', '']);
  const [resend, setResend] = useState(59);
  const [np, setNp] = useState('');
  const [np2, setNp2] = useState('');
  const [err, setErr] = useState('');
  const [errField, setErrField] = useState<'' | 'phone' | 'password'>('');
  // 注册账号资料表单
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [regPwd, setRegPwd] = useState('');
  const [regPwd2, setRegPwd2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // 注册资料表单的「每字段」校验错误(失焦即校验,已出错字段在输入时实时清/重校)
  const [fErr, setFErr] = useState<Record<string, string>>({});
  // sandbox:request-otp 回传的验证码,显示为提示便于联调(接真实短信后后端不再回传)
  const [debugCode, setDebugCode] = useState('');
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  async function postAuth(path: string, payload: Record<string, unknown>) {
    const res = await fetch(`/api/v1/auth/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; user?: unknown; debugCode?: string };
    return { ok: res.ok, data };
  }

  // 后端错误码 → 本地化文案(对齐设计稿现有 auth 文案)
  function errMsg(code?: string): string {
    switch (code) {
      case 'WRONG_PASSWORD':
        return t.wrongPassword;
      case 'NUMBER_NOT_EXIST':
        return t.numberNotExist;
      case 'NUMBER_EXISTS':
      case 'EMAIL_EXISTS':
        return t.numberExists;
      case 'INVALID_CODE':
      case 'CODE_EXPIRED':
      case 'TOO_MANY_ATTEMPTS':
        return t.wrongCode;
      case 'TOO_MANY_REQUESTS':
        return t.tooManyRequests;
      case 'SERVER_ERROR':
        return t.serverError;
      default:
        // 未识别错误(含上游 5xx/网络故障)按"服务不可用"提示,不再误报"验证码错误"
        return t.serverError;
    }
  }

  const authPhone = formatKazakhstanAuthPhone(phone);
  const phoneValid = phone.length === 10;
  const phoneInvalid = phone.length > 0 && !phoneValid;

  // 验证码 59s 重发倒计时
  useEffect(() => {
    if (step !== 'otp') return;
    const id = setInterval(() => setResend((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [step]);

  function goOtp() {
    setStep('otp');
    setResend(59);
    setCode(['', '', '', '']);
  }

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setSubmitting(true);
    const { ok, data } = await postAuth('login', { phone: authPhone, password });
    setSubmitting(false);
    if (!ok) {
      setErr(errMsg(data.error));
      setErrField(data.error === 'WRONG_PASSWORD' ? 'password' : 'phone');
      return;
    }
    setLoggedIn();
    showToast(msgs.toastLoginSuccess, 'success');
    router.push(`/${cl}/app`);
  }

  // 注册/找回的手机号步骤:请求验证码
  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setErrField('');
    setSubmitting(true);
    const purpose = mode === 'register' ? 'register' : 'recover';
    const { ok, data } = await postAuth('request-otp', { phone: authPhone, purpose });
    setSubmitting(false);
    if (!ok) {
      setErr(errMsg(data.error));
      setErrField('phone');
      return;
    }
    setDebugCode(data.debugCode ?? '');
    goOtp();
  }

  function onOtpChange(i: number, v: string) {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[i] = d;
    setCode(next);
    setErr('');
    if (d && i < 3) otpRefs.current[i + 1]?.focus();
  }

  // 校验验证码,通过后进入「账号资料」(注册)或「新密码」(找回)
  async function verifyAndAdvance(joined: string) {
    setSubmitting(true);
    const purpose = mode === 'register' ? 'register' : 'recover';
    const { ok, data } = await postAuth('verify-otp', { phone: authPhone, purpose, code: joined });
    setSubmitting(false);
    if (!ok) {
      setErr(errMsg(data.error));
      return;
    }
    setStep(mode === 'register' ? 'account' : 'newpass');
  }

  function onOtpKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !code[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }

  async function resendCode() {
    setResend(59);
    setCode(['', '', '', '']);
    setErr('');
    otpRefs.current[0]?.focus();
    const purpose = mode === 'register' ? 'register' : 'recover';
    const { ok, data } = await postAuth('request-otp', { phone: authPhone, purpose });
    if (ok) setDebugCode(data.debugCode ?? '');
  }

  async function submitNewPass(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (np !== np2) {
      setErr(t.passwordsMismatch);
      return;
    }
    if (np.length < PASSWORD_MIN || np.length > PASSWORD_MAX) {
      setErr(t.regPasswordHint);
      return;
    }
    setSubmitting(true);
    const { ok, data } = await postAuth('recover', { phone: authPhone, code: code.join(''), password: np });
    setSubmitting(false);
    if (!ok) {
      setErr(errMsg(data.error));
      return;
    }
    setLoggedIn();
    showToast(msgs.toastPasswordChanged, 'success');
    router.push(`/${cl}/app`);
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // 单字段校验:返回错误文案,空串=通过。空值不报(还没填完),交给按钮禁用兜底。
  function fieldError(name: string, value: string): string {
    if (name === 'email') return value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? t.invalidEmail : '';
    if (name === 'regPwd') return value && (value.length < PASSWORD_MIN || value.length > PASSWORD_MAX) ? t.regPasswordHint : '';
    if (name === 'regPwd2') return value && value !== regPwd ? t.passwordsMismatch : '';
    return '';
  }
  // 失焦校验该字段
  const validateOnBlur = (name: string, value: string) =>
    setFErr((p) => ({ ...p, [name]: fieldError(name, value) }));
  // 输入时:仅当该字段已处于出错态才实时重校(出错后边改边消错,未出错则不打扰)
  const revalidateIfErrored = (name: string, value: string) =>
    setFErr((p) => (p[name] ? { ...p, [name]: fieldError(name, value) } : p));

  const displayFieldError = (name: string) => {
    if (!fErr[name]) return '';
    if (name === 'email') return fieldError(name, email);
    if (name === 'regPwd') return fieldError(name, regPwd);
    if (name === 'regPwd2') return fieldError(name, regPwd2);
    return fErr[name];
  };

  // 按钮亮起 = 字段都填了(不卡格式);格式/长度在提交时逐条提示,避免「填满了按钮还灰着」的困惑
  const accountFilled =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    regPwd.length > 0 &&
    regPwd2.length > 0;

  async function submitAccount(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    // 提交时逐字段校验,错误就近显示在对应输入框下(而非底部一行)
    const errs = {
      email: emailValid ? '' : t.invalidEmail,
      regPwd: regPwd.length < PASSWORD_MIN || regPwd.length > PASSWORD_MAX ? t.regPasswordHint : '',
      regPwd2: regPwd !== regPwd2 ? t.passwordsMismatch : ''
    };
    if (errs.email || errs.regPwd || errs.regPwd2) {
      setFErr(errs);
      return;
    }
    setFErr({});
    setSubmitting(true);
    const { ok, data } = await postAuth('register', {
      phone: authPhone,
      code: code.join(''),
      firstName,
      lastName,
      email,
      password: regPwd
    });
    setSubmitting(false);
    if (!ok) {
      setErr(errMsg(data.error));
      return;
    }
    setLoggedIn();
    showToast(msgs.toastAccountCreated, 'success');
    router.push(`/${cl}/app`);
  }

  function back() {
    setErr('');
    setStep('phone');
  }

  // errorText:号码已存在/不存在等字段级错误(优先于格式提示)
  const phoneField = (errorText?: string) => {
    const showErr = errorText || (phoneInvalid ? t.invalidPhone : '');
    return (
      <label className="auth-field">
        <span>{t.phoneLabel}</span>
        <div className={`auth-phone-control ${showErr ? 'invalid' : ''}`}>
          <span className="auth-phone-prefix">+7</span>
          <input
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            value={phone}
            onChange={(e) => {
              setPhone(normalizeKazakhstanLocalPhoneInput(e.target.value));
              setErr('');
              setErrField('');
            }}
            placeholder={t.phonePlaceholder}
            autoComplete="tel-national"
          />
        </div>
        {showErr ? <p className="auth-err">{showErr}</p> : null}
      </label>
    );
  };

  // 通用文本输入(注册账号资料用)。传 name 即开启「失焦校验 + 出错时实时清错」+ 字段下错误提示
  const textField = (
    label: string,
    value: string,
    set: (v: string) => void,
    placeholder: string,
    type = 'text',
    name?: string
  ) => (
    <label className="auth-field">
      <span>{label}</span>
      <input
        type={type}
        className={name && displayFieldError(name) ? 'invalid' : ''}
        value={value}
        onChange={(e) => {
          set(e.target.value);
          if (name) revalidateIfErrored(name, e.target.value);
        }}
        onBlur={name ? (e) => validateOnBlur(name, e.target.value) : undefined}
        placeholder={placeholder}
        autoComplete="off"
      />
      {name && displayFieldError(name) ? <p className="auth-err">{displayFieldError(name)}</p> : null}
    </label>
  );

  const pwdField = (
    label: string,
    value: string,
    set: (v: string) => void,
    invalid = false,
    placeholder = '',
    name?: string
  ) => (
    <label className="auth-field">
      <span>{label}</span>
      <div className="auth-pwd">
        <input
          type={showPwd ? 'text' : 'password'}
          className={invalid || (name && displayFieldError(name)) ? 'invalid' : ''}
          value={value}
          onChange={(e) => {
            set(e.target.value);
            if (name) revalidateIfErrored(name, e.target.value);
          }}
          onBlur={name ? (e) => validateOnBlur(name, e.target.value) : undefined}
          placeholder={placeholder}
          autoComplete="off"
        />
        <button type="button" className="auth-eye" onClick={() => setShowPwd((s) => !s)} aria-label="toggle">
          {showPwd ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3l18 18" />
              <path d="M10.58 10.58a3 3 0 004.24 4.24" />
              <path d="M9.36 5.12A10.4 10.4 0 0112 5c6.5 0 10 7 10 7a17.9 17.9 0 01-3.4 4.06M6.6 6.6A17.7 17.7 0 002 12s3.5 7 10 7a10.3 10.3 0 003.4-.58" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {name && displayFieldError(name) ? <p className="auth-err">{displayFieldError(name)}</p> : null}
    </label>
  );

  const otpView = (
    <div className="auth-center">
      <button type="button" className="auth-back" onClick={back} aria-label="back">
        ‹
      </button>
      <h1 className="auth-title center">{t.otpTitle}</h1>
      <p className="auth-sub">{t.codeSentTo}</p>
      <p className="auth-otp-phone">{authPhone}</p>
      <div className="auth-otp">
        {code.map((c, i) => (
          <input
            key={i}
            ref={(el) => {
              otpRefs.current[i] = el;
            }}
            value={c}
            inputMode="numeric"
            maxLength={1}
            onChange={(e) => onOtpChange(i, e.target.value)}
            onKeyDown={(e) => onOtpKey(i, e)}
            aria-label={`digit ${i + 1}`}
          />
        ))}
      </div>
      {err ? <p className="auth-err center">{err}</p> : null}
      {debugCode ? <p className="auth-sub" style={{ opacity: 0.6 }}>sandbox код: {debugCode}</p> : null}
      <button
        type="button"
        className="button primary auth-submit"
        disabled={code.some((c) => !c) || submitting}
        onClick={() => verifyAndAdvance(code.join(''))}
      >
        {submitting ? <span className="auth-spin" aria-hidden="true" /> : t.forwardBtn}
      </button>
      <button type="button" className="auth-resend" disabled={resend > 0} onClick={resendCode}>
        {resend > 0 ? t.resendAfter(resend) : t.resendNow}
      </button>
    </div>
  );

  let body: React.ReactNode;
  if (mode === 'login') {
    body = (
      <>
        <h1 className="auth-title">{t.loginTitle}</h1>
        <form noValidate onSubmit={submitLogin}>
          {phoneField(errField === 'phone' ? err : undefined)}
          {pwdField(t.passwordLabel, password, setPassword, errField === 'password')}
          <div className="auth-row">
            <span className="auth-err">{errField === 'password' ? err : ''}</span>
            <Link className="auth-forgot" href={`/${cl}/recover`}>
              {t.forgotPassword}
            </Link>
          </div>
          <button type="submit" className="button primary auth-submit" disabled={!phoneValid || !password || submitting}>
            {submitting ? <span className="auth-spin" aria-hidden="true" /> : t.loginBtn}
          </button>
        </form>
        <div className="auth-switch">
          <span>{t.noAccount}</span>
          <Link href={`/${cl}/register`}>{t.createAccountLink}</Link>
        </div>
      </>
    );
  } else if (mode === 'register') {
    if (step === 'otp') body = otpView;
    else if (step === 'account')
      body = (
        <>
          <button type="button" className="auth-back" onClick={() => setStep('otp')} aria-label="back">
            ‹
          </button>
          <h1 className="auth-title">{t.registerTitle}</h1>
          <form noValidate onSubmit={submitAccount}>
            {textField(t.regFirstNameLabel, firstName, setFirstName, t.regFirstNamePlaceholder)}
            {textField(t.regLastNameLabel, lastName, setLastName, t.regLastNamePlaceholder)}
            {textField(t.regEmailLabel, email, setEmail, t.regEmailPlaceholder, 'email', 'email')}
            {pwdField(t.regPasswordLabel, regPwd, setRegPwd, false, t.regPasswordPlaceholder, 'regPwd')}
            {!displayFieldError('regPwd') ? <p className="auth-hint">{t.regPasswordHint}</p> : null}
            {pwdField(t.regConfirmLabel, regPwd2, setRegPwd2, false, t.regConfirmPlaceholder, 'regPwd2')}
            {err ? <p className="auth-err">{err}</p> : null}
            <button type="submit" className="button primary auth-submit" disabled={!accountFilled || submitting}>
              {submitting ? <span className="auth-spin" aria-hidden="true" /> : t.forwardBtn}
            </button>
          </form>
        </>
      );
    else
      body = (
        <>
          <h1 className="auth-title">{t.registerTitle}</h1>
          <form noValidate onSubmit={submitPhone}>
            {phoneField(errField === 'phone' ? err : undefined)}
            <button type="submit" className="button primary auth-submit" disabled={!phoneValid || submitting}>
              {submitting ? <span className="auth-spin" aria-hidden="true" /> : t.receiveSmsBtn}
            </button>
          </form>
          <div className="auth-switch">
            <span>{t.haveAccount}</span>
            <Link href={`/${cl}/login`}>{t.loginLink}</Link>
          </div>
        </>
      );
  } else {
    // recover
    if (step === 'otp') body = otpView;
    else if (step === 'newpass')
      body = (
        <>
          <button type="button" className="auth-back" onClick={() => setStep('otp')} aria-label="back">
            ‹
          </button>
          <h1 className="auth-title">{t.newPasswordTitle}</h1>
          <form noValidate onSubmit={submitNewPass}>
            {pwdField(t.newPasswordLabel, np, setNp, false, t.newPasswordPlaceholder)}
            {pwdField(t.confirmPasswordLabel, np2, setNp2, Boolean(err), t.confirmPasswordPlaceholder)}
            {err ? <p className="auth-err">{err}</p> : null}
            <button type="submit" className="button primary auth-submit" disabled={!np || !np2 || submitting}>
              {submitting ? <span className="auth-spin" aria-hidden="true" /> : t.restoreBtn}
            </button>
          </form>
        </>
      );
    else
      body = (
        <>
          <h1 className="auth-title">{t.recoverTitle}</h1>
          <p className="auth-sub auth-sub-left">{t.recoverSubtitle}</p>
          <form noValidate onSubmit={submitPhone}>
            {phoneField()}
            <button type="submit" className="button primary auth-submit" disabled={!phoneValid || submitting}>
              {submitting ? <span className="auth-spin" aria-hidden="true" /> : t.receiveSmsBtn}
            </button>
          </form>
          <div className="auth-switch">
            <span>{t.haveAccount}</span>
            <Link href={`/${cl}/login`}>{t.loginLink}</Link>
          </div>
        </>
      );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">{body}</div>
    </div>
  );
}
