"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { login, signup, recover, changePassword, signInWithGoogle } from "@/app/actions/auth";
import { SubmitButton } from "./submit-button";
export type AuthMode = "login" | "signup" | "recover" | "password";
const actions = { login, signup, recover, password: changePassword };
const labels = {
  login: "Entrar na minha conta",
  signup: "Criar minha conta",
  recover: "Enviar link de recuperação",
  password: "Salvar nova senha",
};
export function AuthForm({ mode }: { mode: AuthMode }) {
  const [state, action] = useActionState(actions[mode], {});
  const [visible, setVisible] = useState(false);
  const hasPassword = mode !== "recover";
  return (
    <form action={action} className="form-stack">
      {(mode === "login" || mode === "signup") && (
        <>
          <button
            className="google-button"
            type="submit"
            formAction={signInWithGoogle}
            formNoValidate
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19">
              <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.32 2.98-7.4Z"/>
              <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.37l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.83-1.76-5.62-4.13H3.03v2.61A10 10 0 0 0 12 22Z"/>
              <path fill="#FBBC05" d="M6.38 13.92A6.02 6.02 0 0 1 6.06 12c0-.67.12-1.32.32-1.92V7.47H3.03A10 10 0 0 0 2 12c0 1.61.39 3.14 1.03 4.53l3.35-2.61Z"/>
              <path fill="#EA4335" d="M12 5.95c1.47 0 2.8.51 3.84 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.97 5.47l3.35 2.61C7.17 7.71 9.39 5.95 12 5.95Z"/>
            </svg>
            Continuar com Google
          </button>
          <div className="auth-divider"><span>ou continue com e-mail</span></div>
        </>
      )}
      {mode === "signup" && (
        <label>
          Seu nome
          <input
            name="name"
            autoComplete="name"
            placeholder="Como podemos chamar você?"
            required
            minLength={2}
            maxLength={100}
          />
        </label>
      )}
      {mode !== "password" && (
        <label>
          E-mail
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            required
            maxLength={254}
          />
        </label>
      )}
      {hasPassword && (
        <label>
          {mode === "password" ? "Nova senha" : "Senha"}
          <span className="password-field">
            <input
              name="password"
              type={visible ? "text" : "password"}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              minLength={mode === "login" ? 1 : 8}
              maxLength={128}
              placeholder={
                mode === "login" ? "Digite sua senha" : "Crie uma senha segura"
              }
              aria-describedby={mode !== "login" ? "password-hint" : undefined}
            />
            <button
              type="button"
              onClick={() => setVisible(!visible)}
              aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={visible}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
      )}
      {(mode === "signup" || mode === "password") && (
        <>
          <p id="password-hint" className="field-hint">
            Use 8 ou mais caracteres, com maiúscula, minúscula, número e símbolo.
          </p>
          <label>
            Confirme a senha
            <input
              name="confirm"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              placeholder="Digite a senha novamente"
            />
          </label>
        </>
      )}
      {mode === "login" && (
        <Link className="forgot" href="/recuperar-senha">
          Esqueci minha senha
        </Link>
      )}
      {state.error && (
        <p className="feedback error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="feedback success" role="status">
          {state.success}
        </p>
      )}
      <SubmitButton>{labels[mode]}</SubmitButton>
      <p className="auth-switch">
        {mode === "login" ? (
          <>
            Ainda não tem uma conta? <Link href="/cadastro">Criar conta</Link>
          </>
        ) : (
          <>
            Já tem uma conta? <Link href="/login">Voltar para o login</Link>
          </>
        )}
      </p>
    </form>
  );
}
