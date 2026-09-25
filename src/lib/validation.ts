import { z } from "zod";
export const passwordSchema = z
  .string()
  .min(8, "Use pelo menos 8 caracteres.")
  .max(128, "Use até 128 caracteres.")
  .regex(/[a-z]/, "Inclua uma letra minúscula.")
  .regex(/[A-Z]/, "Inclua uma letra maiúscula.")
  .regex(/[0-9]/, "Inclua um número.")
  .regex(/[^\p{L}\p{N}\s]/u, "Inclua um símbolo, como !, @ ou #.");
export const emailSchema = z.email("Informe um e-mail válido.").max(254);
export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome.").max(100),
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "As senhas não coincidem.",
    path: ["confirm"],
  });
export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Use pelo menos 2 caracteres.")
    .max(80, "Use até 80 caracteres."),
  kind: z.enum(["CPF", "CNPJ", "OTHER"]),
});
export const uuidSchema = z.uuid();
export type FormState = { error?: string; success?: string };
