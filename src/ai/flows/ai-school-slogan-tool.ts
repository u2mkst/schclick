'use server';
/**
 * @fileOverview A Genkit flow for generating fun and unique slogans for a school.
 *
 * - generateSchoolSlogan - A function that generates a slogan for a given school.
 * - GenerateSchoolSloganInput - The input type for the generateSchoolSlogan function.
 * - GenerateSchoolSloganOutput - The return type for the generateSchoolSlogan function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSchoolSloganInputSchema = z.object({
  schoolName: z.string().describe('The name of the school for which to generate a slogan.'),
});
export type GenerateSchoolSloganInput = z.infer<typeof GenerateSchoolSloganInputSchema>;

const GenerateSchoolSloganOutputSchema = z.object({
  slogan: z.string().describe('A fun and unique slogan for the school.'),
});
export type GenerateSchoolSloganOutput = z.infer<typeof GenerateSchoolSloganOutputSchema>;

export async function generateSchoolSlogan(input: GenerateSchoolSloganInput): Promise<GenerateSchoolSloganOutput> {
  return generateSchoolSloganFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSchoolSloganPrompt',
  input: {schema: GenerateSchoolSloganInputSchema},
  output: {schema: GenerateSchoolSloganOutputSchema},
  prompt: `You are a creative marketing expert specializing in school branding. Your task is to generate a fun, unique, and catchy slogan for a school.

Generate a single slogan for the school named: {{{schoolName}}}.

The slogan should evoke school spirit and identity, and be suitable for promotional use.`,
});

const generateSchoolSloganFlow = ai.defineFlow(
  {
    name: 'generateSchoolSloganFlow',
    inputSchema: GenerateSchoolSloganInputSchema,
    outputSchema: GenerateSchoolSloganOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
