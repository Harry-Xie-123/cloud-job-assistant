import { getSkillMatches } from "./scoring.js";

const sentenceList = (items) => {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
};

export const generateDraft = (profile, job, score) => {
  const { matches, gaps } = getSkillMatches(profile.skills, job.requiredSkills);
  const matchedSkills = matches.map((item) => item.matched);
  const roleSkills = matches.map((item) => item.required);
  const strongestSignals = profile.experienceSignals || [];
  const signature = profile.publicSignature || "Candidate";

  const cvBullets = [
    `Built a cloud job-matching assistant using React, Node.js, AWS-oriented architecture, Docker, and CI/CD to score graduate roles by skills, location, work rights, degree fit, and closing date.`,
    `Applied ${sentenceList(matchedSkills.slice(0, 4)) || "software engineering skills"} to evaluate role fit and generate tailored application material for ${job.company}.`,
    `Translated complex technical concepts for 40+ students as a UQ course tutor, strengthening communication, mentoring, and stakeholder-facing problem solving.`
  ];

  if (gaps.length) {
    cvBullets.push(
      `Next improvement: add a small project or README section demonstrating ${sentenceList(gaps.slice(0, 3))}.`
    );
  }

  const coverLetter = [
    `Dear ${job.company} recruitment team,`,
    "",
    `I am applying for the ${job.title} role in ${job.location}. I am currently building on my Information Technology background through honours research and postgraduate computer science study, with a focus on practical software, cloud, and analytical problem solving.`,
    "",
    `Your role aligns with my experience in ${sentenceList(roleSkills.slice(0, 4)) || "software and technology delivery"}. ${strongestSignals[0] || ""} ${strongestSignals[1] || ""}`,
    "",
    `I would bring a careful, learning-oriented approach to the team: I enjoy breaking complex systems into understandable pieces, working with others, and improving solutions through feedback. I am especially interested in ${job.company} because this role offers a chance to apply technical skills to real users, real systems, and measurable outcomes.`,
    "",
    "Thank you for considering my application. I would welcome the opportunity to discuss how my technical background, tutoring experience, and cloud project work could contribute to your team.",
    "",
    "Kind regards,",
    signature
  ].join("\n");

  return {
    jobId: job.id,
    company: job.company,
    title: job.title,
    score: score.total,
    cvBullets,
    coverLetter,
    missingEvidence: gaps,
    nextActions: [
      gaps.length ? `Add proof of ${gaps[0]} before applying.` : "Use the strongest matching skills in the first paragraph.",
      "Check work-right eligibility before writing a long application.",
      "Save the final cover letter and application date in the tracker."
    ]
  };
};
