const escapePdf = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "");

const wrap = (text, maxLength = 92) => {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
};

const buildLines = (jobs, profile) => {
  const lines = [
    "Cloud Job Assistant - Job Tracker Export",
    `Candidate profile: ${profile.publicSignature || profile.name || "Candidate"}`,
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    ""
  ];

  jobs.forEach((job, index) => {
    lines.push(`${index + 1}. ${job.title} - ${job.company}`);
    lines.push(`   Score ${job.score?.total ?? "N/A"} | ${job.score?.recommendation ?? "N/A"} | ${job.status || "saved"} | closes ${job.closingDate || "TBC"}`);
    lines.push(`   Location: ${job.location || "TBC"}`);
    if (job.score?.breakdown?.skills?.gaps?.length) {
      lines.push(`   Skill gaps: ${job.score.breakdown.skills.gaps.join(", ")}`);
    }
    if (job.sourceUrl) {
      lines.push(`   Link: ${job.sourceUrl}`);
    }
    lines.push("");
  });

  return lines.flatMap((line) => wrap(line));
};

export const jobsToPdf = (jobs, profile = {}) => {
  const lines = buildLines(jobs, profile);
  const contentLines = ["BT", "/F1 10 Tf", "50 792 Td", "14 TL"];

  lines.slice(0, 52).forEach((line, index) => {
    if (index === 0) {
      contentLines.push(`(${escapePdf(line)}) Tj`);
    } else {
      contentLines.push("T*");
      contentLines.push(`(${escapePdf(line)}) Tj`);
    }
  });
  contentLines.push("ET");

  const stream = Buffer.from(contentLines.join("\n"), "utf8");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream.toString("utf8")}\nendstream`
  ];

  const chunks = [Buffer.from("%PDF-1.4\n", "utf8")];
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.concat(chunks).length);
    chunks.push(Buffer.from(`${index + 1} 0 obj\n${object}\nendobj\n`, "utf8"));
  });

  const xrefOffset = Buffer.concat(chunks).length;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
    ""
  ].join("\n");

  return Buffer.concat([...chunks, Buffer.from(xref, "utf8")]);
};
