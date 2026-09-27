import { groq, AI_MODELS } from "@/lib/ai";
import { z } from "zod";

export interface TechnicalQuestion {
  id: number;
  category: "DSA" | "OS" | "DBMS" | "OOPS";
  question: string;
  expectedAnswer: string;
  maxMarks: number;
}

export interface TechnicalInterviewQuestions {
  questions: TechnicalQuestion[];
}

export interface TechnicalGradingResult {
  totalScore: number;
  maxScore: number;
  percentage: number;
  breakdown: Array<{
    questionId: number;
    category: string;
    question: string;
    candidateAnswer: string;
    marks: number;
    maxMarks: number;
    feedback: string;
  }>;
  summary: string;
}

const TechnicalQuestionsSchema = z.object({
  questions: z.array(
    z.object({
      id: z.number(),
      category: z.enum(["DSA", "OS", "DBMS", "OOPS"]),
      question: z.string(),
      expectedAnswer: z.string(),
      maxMarks: z.number(),
    })
  ),
});

const TechnicalGradingSchema = z.object({
  totalScore: z.number(),
  maxScore: z.number(),
  percentage: z.number(),
  breakdown: z.array(
    z.object({
      questionId: z.number(),
      category: z.string(),
      question: z.string(),
      candidateAnswer: z.string(),
      marks: z.number(),
      maxMarks: z.number(),
      feedback: z.string(),
    })
  ),
  summary: z.string(),
});

/**
 * Generate 10 SDE Technical Interview Questions:
 * DSA: 1 question
 * OS: 3 questions
 * DBMS: 3 questions
 * OOPS: 3 questions
 */
export async function generateTechnicalInterviewQuestions({
  jobTitle,
  jobDescription,
}: {
  jobTitle: string;
  jobDescription: string;
}): Promise<{ success: true; questions: TechnicalQuestion[] } | { success: false; error: string }> {
  const prompt = `You are a senior technical interviewer designing an SDE Technical Interview.
Generate exactly 10 technical interview questions for a candidate applying to this role:

## Job Title
${jobTitle}

## Job Description
${jobDescription.slice(0, 4000)}

## Distribution Requirements (Exactly 10 questions):
- DSA (Data Structures & Algorithms): 1 question (worth 10 marks)
- OS (Operating Systems): 3 questions (worth 10 marks each)
- DBMS (Database Management Systems): 3 questions (worth 10 marks each)
- OOPS (Object-Oriented Programming Systems): 3 questions (worth 10 marks each)

Total Max Marks = 100.

Return ONLY a JSON object matching this schema:
{
  "questions": [
    {
      "id": 1,
      "category": "DSA|OS|DBMS|OOPS",
      "question": "Question text",
      "expectedAnswer": "Detailed expected answer for grading",
      "maxMarks": 10
    }
  ]
}`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: AI_MODELS.assessment,
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const rawResponse = chatCompletion.choices[0]?.message?.content;
    if (!rawResponse) {
      return { success: false, error: "Empty response from AI" };
    }

    const cleaned = rawResponse.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    const validation = TechnicalQuestionsSchema.safeParse(parsed);
    if (!validation.success) {
      return { success: false, error: "AI questions failed schema validation" };
    }

    return { success: true, questions: validation.data.questions };
  } catch (err) {
    console.error("[TechnicalInterview] Error generating questions:", err);
    return { success: false, error: "Failed to generate technical interview questions" };
  }
}

/**
 * Grade 10 manual text answers for SDE Technical Interview.
 */
export async function evaluateTechnicalInterviewAnswers({
  jobTitle,
  questions,
  answers,
}: {
  jobTitle: string;
  questions: TechnicalQuestion[];
  answers: Array<{ questionId: number; answer: string }>;
}): Promise<{ success: true; result: TechnicalGradingResult } | { success: false; error: string }> {
  const qMap = new Map(questions.map((q) => [q.id, q]));
  const questionsBlock = questions
    .map(
      (q) =>
        `### Question ${q.id} [${q.category}] (Max Marks: ${q.maxMarks})\n${q.question}\nExpected Answer: ${q.expectedAnswer}`
    )
    .join("\n\n");

  const answersBlock = answers
    .map((a) => {
      const q = qMap.get(a.questionId);
      return `### Answer to Question ${a.questionId} [${q?.category || "Unknown"}]:\n${a.answer || "(No answer provided)"}`;
    })
    .join("\n\n");

  const prompt = `You are a principal SDE evaluator. Grade the candidate's manual typed answers for this technical interview.

## Job Title
${jobTitle}

## Questions & Expected Answers
${questionsBlock}

## Candidate Answers
${answersBlock}

## Grading Rules:
1. Grade each question fairly out of 10 marks based on technical correctness, conceptual clarity, and completeness.
2. Calculate totalScore as the sum of all marks (out of 100 max).
3. Set percentage = totalScore (since max score is 100).
4. Provide concise feedback for each question explaining marks awarded.

Return ONLY a JSON object matching this schema:
{
  "totalScore": 78,
  "maxScore": 100,
  "percentage": 78,
  "breakdown": [
    {
      "questionId": 1,
      "category": "DSA",
      "question": "Question text",
      "candidateAnswer": "Candidate answer text",
      "marks": 8,
      "maxMarks": 10,
      "feedback": "Feedback text"
    }
  ],
  "summary": "Overall candidate technical summary."
}`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: AI_MODELS.assessmentGrading,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const rawResponse = chatCompletion.choices[0]?.message?.content;
    if (!rawResponse) {
      return { success: false, error: "Empty response from AI" };
    }

    const cleaned = rawResponse.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    const validation = TechnicalGradingSchema.safeParse(parsed);
    if (!validation.success) {
      return { success: false, error: "AI grading failed schema validation" };
    }

    return { success: true, result: validation.data };
  } catch (err) {
    console.error("[TechnicalInterview] Error evaluating answers:", err);
    return { success: false, error: "Failed to evaluate technical interview" };
  }
}
