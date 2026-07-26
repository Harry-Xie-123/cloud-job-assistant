const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .trim();

const containsMatch = (candidateValue, requiredValue) => {
  const candidate = normalize(candidateValue);
  const required = normalize(requiredValue);

  if (!candidate || !required) return false;
  if (candidate === required) return true;
  if (candidate.includes(required) || required.includes(candidate)) return true;

  const aliases = {
    "cloud": ["aws", "ec2", "s3", "rds", "lambda", "vpc"],
    "software development": ["javascript", "python", "c++", "react", "node.js", "oop"],
    "full stack development": ["react", "node.js", "javascript", "html", "css", "sql"],
    "cyber security": ["cloud security", "iam", "vpc"],
    "networking": ["vpc", "system integration", "infrastructure"],
    "business analysis": ["process modelling", "enterprise architecture", "system integration"],
    "stakeholder communication": ["presentation", "tutored", "mentoring"]
  };

  const related = aliases[required] || [];
  return related.some((alias) => candidate.includes(alias));
};

export const getSkillMatches = (profileSkills, requiredSkills) => {
  const matches = [];
  const gaps = [];

  for (const skill of requiredSkills || []) {
    const matched = (profileSkills || []).find((candidateSkill) =>
      containsMatch(candidateSkill, skill)
    );

    if (matched) {
      matches.push({ required: skill, matched });
    } else {
      gaps.push(skill);
    }
  }

  return { matches, gaps };
};

const scoreSkills = (profile, job) => {
  const { matches, gaps } = getSkillMatches(profile.skills, job.requiredSkills);
  const total = Math.max((job.requiredSkills || []).length, 1);
  return {
    points: Math.round((matches.length / total) * 35),
    matches,
    gaps
  };
};

const scoreLocation = (profile, job) => {
  const jobLocation = normalize(job.location);
  const preferred = profile.preferredLocations || [];
  const matched = preferred.find((location) => jobLocation.includes(normalize(location)));
  return {
    points: matched ? 15 : 6,
    matched: matched || null,
    reason: matched ? `Location includes ${matched}.` : "Location is not an obvious preference match."
  };
};

const scoreDegree = (profile, job) => {
  const degrees = profile.degrees || [];
  const disciplines = job.degreeDisciplines || [];
  const matched = disciplines.find((discipline) =>
    degrees.some((degree) => containsMatch(degree, discipline))
  );

  return {
    points: matched ? 15 : 8,
    matched: matched || null,
    reason: matched ? `Degree aligns with ${matched}.` : "Degree fit should be checked manually."
  };
};

const scoreWorkRights = (profile, job) => {
  const candidateRights = (profile.workRights || []).map(normalize);
  const jobRights = (job.workRights || []).map(normalize);

  if (jobRights.some((right) => right.includes("accepts international"))) {
    return {
      points: 20,
      status: "good",
      reason: "Listing indicates it accepts international applicants."
    };
  }

  if (jobRights.some((right) => right.includes("check listing"))) {
    return {
      points: 10,
      status: "unknown",
      reason: "Work rights are not clear. Confirm before applying."
    };
  }

  const matched = jobRights.find((right) =>
    candidateRights.some((candidateRight) => candidateRight.includes(right) || right.includes(candidateRight))
  );

  if (matched) {
    return {
      points: 20,
      status: "good",
      reason: `Candidate work rights appear to match ${matched}.`
    };
  }

  return {
    points: 4,
    status: "risk",
    reason: "Work rights may not match. Confirm eligibility before spending time on this application."
  };
};

const scoreClosingDate = (job, now = new Date()) => {
  if (!job.closingDate) {
    return {
      points: 6,
      urgency: "unknown",
      reason: "No closing date found."
    };
  }

  const close = new Date(`${job.closingDate}T23:59:59`);
  const diffMs = close.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return {
      points: 0,
      urgency: "closed",
      reason: "Closing date has passed."
    };
  }

  if (days <= 3) {
    return {
      points: 10,
      urgency: "urgent",
      reason: `Closes in ${days} day(s). Apply soon if eligible.`
    };
  }

  if (days <= 21) {
    return {
      points: 15,
      urgency: "active",
      reason: `Closes in ${days} day(s).`
    };
  }

  return {
    points: 12,
    urgency: "later",
    reason: `Closes in ${days} day(s).`
  };
};

export const scoreJob = (profile, job, options = {}) => {
  const now = options.now || new Date();
  const skills = scoreSkills(profile, job);
  const location = scoreLocation(profile, job);
  const degree = scoreDegree(profile, job);
  const workRights = scoreWorkRights(profile, job);
  const closingDate = scoreClosingDate(job, now);

  const total = Math.min(
    100,
    skills.points + location.points + degree.points + workRights.points + closingDate.points
  );

  const recommendation =
    total >= 80
      ? "apply"
      : total >= 65
        ? "tailor"
        : total >= 45
          ? "maybe"
          : "skip";

  return {
    jobId: job.id,
    total,
    recommendation,
    breakdown: {
      skills,
      location,
      degree,
      workRights,
      closingDate
    }
  };
};

export const scoreJobs = (profile, jobs, options = {}) =>
  jobs
    .map((job) => ({
      ...job,
      score: scoreJob(profile, job, options)
    }))
    .sort((a, b) => b.score.total - a.score.total);

