import { z } from "zod";

const optionalNonEmptyString = z.string().min(1).optional();

export const createPatientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(1),
  email: optionalNonEmptyString,
  dob: z.union([z.string(), z.date()]).optional(),
  isVeteran: z.boolean().optional(),
}).strip();

export const updatePatientSchema = z.object({
  firstName: optionalNonEmptyString,
  lastName: optionalNonEmptyString,
  phone: optionalNonEmptyString,
  email: optionalNonEmptyString,
  dob: z.union([z.string(), z.date()]).optional(),
  isVeteran: z.boolean().optional(),
}).strip();
