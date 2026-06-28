import { randomBytes } from "node:crypto";

export const PASSWORD_MAX_AGE_DAYS = 45;
export const PASSWORD_WARN_DAYS = 7;

export type PasswordValidation = { ok: true } | { ok: false; error: string };

export function validateStrongPassword(password: string): PasswordValidation {
  if (!password || password.length < 12) {
    return { ok: false, error: "Senha deve ter no mínimo 12 caracteres." };
  }
  if (!/[a-z]/.test(password)) {
    return { ok: false, error: "Senha deve conter letra minúscula." };
  }
  if (!/[A-Z]/.test(password)) {
    return { ok: false, error: "Senha deve conter letra maiúscula." };
  }
  if (!/[0-9]/.test(password)) {
    return { ok: false, error: "Senha deve conter número." };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, error: "Senha deve conter caractere especial." };
  }
  return { ok: true };
}

export function generateTemporaryPassword(length = 14): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;
  const pick = (chars: string) => chars[randomBytes(1)[0] % chars.length];
  const required = [pick(upper), pick(lower), pick(digits), pick(special)];
  const rest = Array.from({ length: Math.max(0, length - required.length) }, () =>
    pick(all)
  );
  const merged = [...required, ...rest];
  for (let i = merged.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [merged[i], merged[j]] = [merged[j], merged[i]];
  }
  return merged.join("");
}

export function passwordExpiresAt(changedAt: Date): Date {
  const d = new Date(changedAt);
  d.setDate(d.getDate() + PASSWORD_MAX_AGE_DAYS);
  return d;
}

export function passwordStatus(changedAt: Date, mustChangePassword: boolean) {
  if (mustChangePassword) {
    return {
      mustChangePassword: true,
      passwordExpired: false,
      passwordExpiringSoon: false,
      passwordExpiresInDays: null as number | null,
    };
  }
  const expiresAt = passwordExpiresAt(changedAt);
  const msLeft = expiresAt.getTime() - Date.now();
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  const passwordExpired = daysLeft <= 0;
  return {
    mustChangePassword: false,
    passwordExpired,
    passwordExpiringSoon: !passwordExpired && daysLeft <= PASSWORD_WARN_DAYS,
    passwordExpiresInDays: passwordExpired ? 0 : daysLeft,
  };
}
