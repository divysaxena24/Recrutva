const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env' });

const sql = neon(process.env.DATABASE_URL);

const mockAnalysis = {
  totalScore: 85,
  executiveSummary: "Vedant demonstrated a strong understanding of full-stack development principles, particularly in React and Node.js. He communicated technical concepts clearly and showed a proactive approach to problem-solving. While some advanced deployment strategies could use refinement, he is a highly capable candidate.",
  breakdown: [
    {
      question: "Hello! I'm Sarah, your AI interviewer today. To get started, could you please introduce yourself and tell me a bit about your background in software development?",
      expectedAnswer: "Candidate should introduce themselves, state their current role, and summarize their experience in software development, highlighting key technologies they use.",
      userAnswer: "Hi Sarah. I'm Vedant. I've been a full-stack developer for about 3 years now. I mainly work with the MERN stack, React, Node.js, and PostgreSQL.",
      marks: 9,
      feedback: "Great, concise introduction. Clearly stated your core tech stack and experience level."
    },
    {
      question: "That's interesting. What would you say is your biggest technical strength, and how has it helped you in your recent projects?",
      expectedAnswer: "Candidate should clearly identify a specific technical strength (e.g., frontend architecture, API design) and provide a concrete example of how it benefited a project.",
      userAnswer: "My biggest strength is definitely frontend architecture with React. In my last project, I restructured our component tree which reduced re-renders by 40% and drastically improved the app's performance.",
      marks: 9,
      feedback: "Excellent answer. You provided a specific strength and backed it up with a quantifiable achievement (40% reduction in re-renders)."
    },
    {
      question: "Can you describe a particularly challenging technical problem you've faced recently and how you went about solving it?",
      expectedAnswer: "Candidate should describe a complex technical issue, explain their debugging/problem-solving process, and state the final resolution.",
      userAnswer: "We had a major memory leak in our Node server. I used Chrome DevTools to take heap snapshots, identified that a caching library wasn't clearing old entries, and implemented a TTL to fix it.",
      marks: 8,
      feedback: "Good technical explanation of the debugging process. Mentioning heap snapshots shows strong profiling skills."
    },
    {
      question: "How do you approach learning new technologies or frameworks when you're starting a project?",
      expectedAnswer: "Candidate should outline a structured learning approach, such as reading documentation, building small prototypes, or taking courses.",
      userAnswer: "I usually start by reading the official documentation to understand the core concepts. Then I build a small 'Hello World' prototype. After that, I dive straight into building the actual feature and learn the nuances as I go.",
      marks: 8,
      feedback: "A solid, practical approach to learning. Emphasizing official documentation is a great best practice."
    },
    {
      question: "Great. Final question: What are your long-term career goals, and how does this role fit into those plans?",
      expectedAnswer: "Candidate should articulate career aspirations that align with the potential growth opportunities in the role they are interviewing for.",
      userAnswer: "In the long term, I want to become a Technical Lead. I think this role is perfect because it gives me end-to-end ownership of the product, allowing me to mentor junior devs while still writing code.",
      marks: 8,
      feedback: "Very strong alignment between personal goals and the role's responsibilities."
    }
  ]
};

async function run() {
  try {
    console.log("Injecting mock analysis for Vedant Singh...");
    await sql`
      UPDATE applicants 
      SET status = 'Completed', 
          analysis = ${JSON.stringify(mockAnalysis)}::jsonb,
          score = '85',
          match_score = '85'
      WHERE id = 2
    `;
    console.log("Mock data injected successfully.");
  } catch (err) {
    console.error(err);
  }
}

run();
