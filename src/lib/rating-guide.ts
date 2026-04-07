/** Full “Suggested performance ratings” copy for the in-app guide. */

export const RATING_GUIDE_INTRO =
  "A 5-point rating scale supports meaningful performance conversations, consistent decision-making, and a fair, transparent link to remuneration, rewarding high performance while reinforcing accountability and development.";

export type RatingGuideEntry = {
  title: string;
  bullets: string[];
};

export const RATING_GUIDE_BY_SCORE: Record<number, RatingGuideEntry> = {
  1: {
    title: "Does not meet expectations",
    bullets: [
      "Does not consistently meet the core requirements of the role.",
      "Outcomes fall below expected standards for students, partners, colleagues, or the organisation.",
      "Demonstrates gaps in required skills, professional capability, or role-related knowledge.",
      "Behaviours do not consistently align with organisation or professional expectations.",
      "Requires significant support, direction, and development to perform effectively in the role.",
    ],
  },
  2: {
    title: "Needs improvement",
    bullets: [
      "Meets some role requirements but performance and/or behaviours are inconsistent.",
      "Outcomes sometimes meet expectations but do not consistently achieve required standards.",
      "Demonstrates developing capability, with clear gaps in skills, confidence, or application.",
      "Professional behaviours are generally appropriate but may lack consistency or impact.",
      "Requires ongoing guidance and development to reliably meet role expectations.",
    ],
  },
  3: {
    title: "Meets expectations",
    bullets: [
      "Consistently meets the requirements of the role.",
      "Delivers outcomes that meet agreed standards for quality, timeliness, and impact.",
      "Demonstrates the required skills, professional capability, and role-related knowledge.",
      "Behaviours align with the organisation and professional expectations.",
      "Works collaboratively and contributes positively to students, partners, colleagues, and the organisation.",
    ],
  },
  4: {
    title: "Exceeds expectations",
    bullets: [
      "Frequently exceeds role requirements in both outcomes and professional behaviours.",
      "Delivers high-quality outcomes that positively impact students, partners, teams, or the organisation.",
      "Demonstrates strong capability, initiative, and sound professional judgement.",
      "Consistently models positive behaviours aligned to the organisation.",
      "Occasionally takes on additional responsibilities or contributes to improvements beyond their role.",
    ],
  },
  5: {
    title: "Outstanding",
    bullets: [
      "Consistently delivers exceptional outcomes well beyond role expectations.",
      "Demonstrates advanced capability, expertise, and leadership within their role.",
      "Acts as a role model for professional behaviour, values, and best practice.",
      "Makes a significant and sustained positive impact on students, partners, colleagues, and/or the organisation.",
      "Regularly leads initiatives, mentors others, or drives meaningful improvement.",
    ],
  },
};
