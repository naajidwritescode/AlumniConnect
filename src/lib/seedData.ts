import { doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

// List of realistic sample users and profiles
export const SAMPLE_ALUMNI = [
  {
    uid: "alumni_ahmed",
    email: "ahmed.rahman@example.com",
    displayName: "Ahmed Rahman",
    photoURL: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    role: "alumnus" as const,
    profile: {
      graduationYear: 2018,
      university: "Boston Institute of Technology",
      degree: "B.S. Computer Science",
      currentJobTitle: "Senior Software Engineer",
      currentCompany: "Google",
      country: "United States",
      availableToMentor: true,
      approvalStatus: "approved" as const,
      journey: {
        whatTheyStudied: "I focused on algorithms and systems. I also took a minor in Technical Writing which actually helped me write better documentation and design docs.",
        howTheyGotThere: "Started with a local internship at a mid-sized startup, then contributed to open source libraries. Applied through a cold referral on LinkedIn and passed the technical interviews.",
        whatHelpedMost: "Building complete side projects from scratch. Understanding standard databases (PostgreSQL) and how microservices communicate was a huge plus.",
        whatTheyWouldDoDifferently: "I would have participated in more hackathons and career fairs in my sophomore year, rather than waiting until senior year.",
        adviceForStudents: "Learn how to communicate your ideas clearly. Great code is worthless if your team doesn't understand your design or cannot maintain it."
      }
    }
  },
  {
    uid: "alumni_jane",
    email: "jane.doe@example.com",
    displayName: "Jane Doe",
    photoURL: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    role: "alumnus" as const,
    profile: {
      graduationYear: 2021,
      university: "Boston Institute of Technology",
      degree: "B.A. Interaction Design",
      currentJobTitle: "Lead UX Researcher",
      currentCompany: "Airbnb",
      country: "United States",
      availableToMentor: true,
      approvalStatus: "approved" as const,
      journey: {
        whatTheyStudied: "I studied human-computer interaction, visual hierarchies, and cognitive psychology.",
        howTheyGotThere: "Created a strong portfolio showcasing the end-to-end user research process, not just final mockups. Secured an associate role and worked my way up.",
        whatHelpedMost: "Conducting actual user tests with real people for school projects, rather than just designing theoretical interfaces.",
        whatTheyWouldDoDifferently: "I wish I had learned basic HTML/CSS earlier to better understand the technical constraints developers face.",
        adviceForStudents: "Focus on empathy and curiosity. Ask 'why' five times when analyzing user friction."
      }
    }
  },
  {
    uid: "alumni_carlos",
    email: "carlos.gomez@example.com",
    displayName: "Carlos Gomez",
    photoURL: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
    role: "alumnus" as const,
    profile: {
      graduationYear: 2015,
      university: "Boston Institute of Technology",
      degree: "B.S. Mechanical Engineering",
      currentJobTitle: "Senior Robotics Architect",
      currentCompany: "Tesla",
      country: "Canada",
      availableToMentor: true,
      approvalStatus: "approved" as const,
      journey: {
        whatTheyStudied: "Solid mechanics, CAD modeling, and dynamics of machinery.",
        howTheyGotThere: "Participated in the university Formula SAE racing team, which caught the eye of recruiters. Landed a hardware development role in Toronto.",
        whatHelpedMost: "Hands-on experience in the campus machine shop and prototyping labs.",
        whatTheyWouldDoDifferently: "I would have taken more fundamental control theory and basic embedded software courses.",
        adviceForStudents: "Get your hands dirty. Join dynamic engineering clubs where you actually build physical things."
      }
    }
  },
  {
    uid: "alumni_emily",
    email: "emily.chen@example.com",
    displayName: "Emily Chen",
    photoURL: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150",
    role: "alumnus" as const,
    profile: {
      graduationYear: 2016,
      university: "Boston Institute of Technology",
      degree: "Pre-Med & Biotechnology",
      currentJobTitle: "Pediatric Resident",
      currentCompany: "Royal Children's Hospital",
      country: "Australia",
      availableToMentor: false,
      approvalStatus: "approved" as const,
      journey: {
        whatTheyStudied: "Biochemistry, clinical trials, and molecular genetics.",
        howTheyGotThere: "Studied for the MCAT while working part-time in a research lab, completed medical school, and matched into my top choice pediatric residency.",
        whatHelpedMost: "Strong mentorship from a university biology professor who guided my research publications.",
        whatTheyWouldDoDifferently: "I would have spent more time volunteering in community clinics early on to understand healthcare disparities.",
        adviceForStudents: "Medicine is a marathon. Prioritize mental health and build a strong support group outside of classes."
      }
    }
  },
  {
    uid: "alumni_sophia",
    email: "sophia.kovalev@example.com",
    displayName: "Sophia Kovalev",
    photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    role: "alumnus" as const,
    profile: {
      graduationYear: 2019,
      university: "Boston Institute of Technology",
      degree: "M.B.A. International Business",
      currentJobTitle: "Global Product Manager",
      currentCompany: "SAP",
      country: "Germany",
      availableToMentor: true,
      approvalStatus: "approved" as const,
      journey: {
        whatTheyStudied: "Strategic management, cross-border trade, and tech entrepreneurship.",
        howTheyGotThere: "Worked as a management consultant in Frankfurt, then pivoted into tech product management at SAP's headquarters.",
        whatHelpedMost: "Case study competitions. They forced me to think on my feet and pitch solutions to real corporate executives.",
        whatTheyWouldDoDifferently: "I would have spent a semester studying abroad in Asia to diversify my international business outlook.",
        adviceForStudents: "Learn to love data. Even in qualitative roles, being able to justify decisions with structured metrics is powerful."
      }
    }
  },
  {
    uid: "alumni_fatima",
    email: "fatima.alsayed@example.com",
    displayName: "Fatima Al-Sayed",
    photoURL: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150",
    role: "alumnus" as const,
    profile: {
      graduationYear: 2020,
      university: "Boston Institute of Technology",
      degree: "B.S. Civil Engineering",
      currentJobTitle: "Infrastructure Consultant",
      currentCompany: "Arup",
      country: "United Arab Emirates",
      availableToMentor: true,
      approvalStatus: "approved" as const,
      journey: {
        whatTheyStudied: "Structural mechanics, green concrete mixtures, and smart urban design.",
        howTheyGotThere: "Secured a highly competitive summer internship with Arup during my third year, which transitioned into a full-time offer.",
        whatHelpedMost: "Learning advanced structural calculation software (BIM) and networking at local civil engineer conventions.",
        whatTheyWouldDoDifferently: "I would have taken a course on project finance, as managing project budgets is a vital part of senior consulting.",
        adviceForStudents: "In civil works, safety and sustainability are paramount. Don't cut corners; be precise in your estimations."
      }
    }
  },
  {
    uid: "alumni_liam",
    email: "liam.oconnor@example.com",
    displayName: "Liam O'Connor",
    photoURL: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150",
    role: "alumnus" as const,
    profile: {
      graduationYear: 2017,
      university: "Boston Institute of Technology",
      degree: "B.S. Finance & Analytics",
      currentJobTitle: "Investment Analyst",
      currentCompany: "Stripe",
      country: "Ireland",
      availableToMentor: true,
      approvalStatus: "approved" as const,
      journey: {
        whatTheyStudied: "Corporate valuation, financial modeling, and database querying (SQL).",
        howTheyGotThere: "Worked for 2 years at an investment bank in Dublin before transitioning into corporate development and finance at Stripe.",
        whatHelpedMost: "Advanced training in spreadsheet modeling and data analytics.",
        whatTheyWouldDoDifferently: "I should have taken more behavioral economics modules to better understand market sentiment dynamics.",
        adviceForStudents: "Learn SQL and python. Standard spreadsheets are no longer enough for high-end financial analysts in tech."
      }
    }
  },
  // Pending queue entries
  {
    uid: "alumni_alex",
    email: "alex.mercer@example.com",
    displayName: "Alex Mercer",
    photoURL: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150",
    role: "alumnus" as const,
    profile: {
      graduationYear: 2023,
      university: "Boston Institute of Technology",
      degree: "B.S. Computer Engineering",
      currentJobTitle: "Embedded Engineer",
      currentCompany: "Intel",
      country: "United States",
      availableToMentor: true,
      approvalStatus: "pending" as const,
      journey: {
        whatTheyStudied: "Microprocessors, circuit synthesis, and real-time operating systems.",
        howTheyGotThere: "Did a senior year capstone project on IoT sensor grids, which got featured in an engineering journal. Reached out to Intel managers directly.",
        whatHelpedMost: "Familiarity with hardware description languages (Verilog/VHDL) and low-level debugging.",
        whatTheyWouldDoDifferently: "I would spend more time writing solid code documentation instead of keeping designs purely inside my head.",
        adviceForStudents: "Never stop learning. Silicon architectures change rapidly, so focus on the fundamental electronics physics."
      }
    }
  },
  {
    uid: "alumni_zoe",
    email: "zoe.vance@example.com",
    displayName: "Zoe Vance",
    photoURL: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
    role: "alumnus" as const,
    profile: {
      graduationYear: 2024,
      university: "Boston Institute of Technology",
      degree: "B.S. Aerospace Systems",
      currentJobTitle: "Aerodynamics Intern",
      currentCompany: "Airbus",
      country: "France",
      availableToMentor: true,
      approvalStatus: "pending" as const,
      journey: {
        whatTheyStudied: "Computational fluid dynamics, propulsion mechanics, and avionics.",
        howTheyGotThere: "Applied via Airbus's graduate entry scheme in Toulouse right after defense of my senior thesis.",
        whatHelpedMost: "Hands-on simulation tools training and familiarity with wind-tunnel operation parameters.",
        whatTheyWouldDoDifferently: "I would pay more attention to materials science, as composite compounds are the future of flight design.",
        adviceForStudents: "Don't be intimidated by difficult calculations. Build your intuition first, then solve the equations."
      }
    }
  }
];

export const SAMPLE_OPPORTUNITIES = [
  {
    opportunityId: "opp_1",
    postedBy: "alumni_jane",
    type: "internship" as const,
    title: "Google UX Research Summer Internship",
    description: "Join the Google hardware design group for a 12-week summer program in Mountain View. You will assist in conducting usability studies, drafting customer personas, and presenting interaction layouts for smart home devices.",
    externalLink: "https://careers.google.com/internships/",
    deadline: Timestamp.fromDate(new Date("2026-09-30")),
    createdAt: Timestamp.now()
  },
  {
    opportunityId: "opp_2",
    postedBy: "alumni_ahmed",
    type: "job" as const,
    title: "Junior Backend Developer (Go / Node)",
    description: "Google is looking for a junior backend developer to join the Cloud Console development team. Perfect for recent graduates. Experience with TypeScript, Express, and standard database systems is highly desired.",
    externalLink: "https://careers.google.com",
    deadline: null,
    createdAt: Timestamp.now()
  },
  {
    opportunityId: "opp_3",
    postedBy: "alumni_sophia",
    type: "scholarship" as const,
    title: "SAP Excellence in Product Management Scholarship",
    description: "A €10,000 scholarship program paired with an optional 6-month paid internship at SAP's Berlin office. Open to final-year master's students studying Business, CS, or related fields.",
    externalLink: "https://sap.com/scholarships",
    deadline: Timestamp.fromDate(new Date("2026-08-15")),
    createdAt: Timestamp.now()
  },
  {
    opportunityId: "opp_4",
    postedBy: "alumni_carlos",
    type: "competition" as const,
    title: "Global Autonomous Drone Racing Challenge",
    description: "A team-based software engineering competition with a $50,000 top prize. Teams must program a standardized drone to navigate a complex physical course safely in simulated environments. Hardware is provided for finalists.",
    externalLink: "https://dronechallenge.org",
    deadline: Timestamp.fromDate(new Date("2026-11-01")),
    createdAt: Timestamp.now()
  },
  {
    opportunityId: "opp_5",
    postedBy: "alumni_liam",
    type: "workshop" as const,
    title: "Advanced Financial Modeling for Tech Startups",
    description: "A 4-part virtual masterclass hosted by Stripe analysts. Learn how to design a SaaS unit economics spreadsheet, forecast cash burn, and model seed-stage cap tables. Free for registered students of our network.",
    externalLink: "https://stripe.com/events/modeling",
    deadline: Timestamp.fromDate(new Date("2026-07-28")),
    createdAt: Timestamp.now()
  }
];

export const SAMPLE_ANNOUNCEMENTS = [
  {
    announcementId: "ann_1",
    postedBy: "admin",
    title: "BIT Global Alumni Homecoming Meetup 2026",
    description: "We are thrilled to announce the 2026 Annual Alumni Homecoming Meetup on our main campus! Join us for a weekend of networking, career panels, and reconnecting with fellow classmates. Dinner and drinks will be served. Registration is required.",
    eventDate: Timestamp.fromDate(new Date("2026-09-15T18:00:00")),
    location: "Campus Grand Ballroom & Virtual Stream",
    createdAt: Timestamp.now()
  },
  {
    announcementId: "ann_2",
    postedBy: "admin",
    title: "Live Panel: Navigating Modern Tech Roles in 2026",
    description: "Join us for an interactive discussion with alumni currently working at Airbnb, Stripe, and Google. We will dive into topics such as shifting career expectations, AI in engineering, and how to format resumes for competitive tech roles.",
    eventDate: Timestamp.fromDate(new Date("2026-08-01T15:00:00")),
    location: "Zoom Virtual Link (will be sent to members)",
    createdAt: Timestamp.now()
  },
  {
    announcementId: "ann_3",
    postedBy: "admin",
    title: "Welcome to AlumniConnect!",
    description: "Welcome to our newly launched AlumniConnect portal. This space is designed specifically to foster high-impact mentorships and career discoveries for our school community. Please browse the directory, keep profiles up to date, and enjoy structured, respectful connections.",
    eventDate: null,
    location: "AlumniConnect Portal",
    createdAt: Timestamp.now()
  }
];

// Seeding function called upon network setup
export async function seedDemoData(adminUid: string) {
  try {
    console.log("Seeding demo data...");

    // 1. Seed alumni users and profiles
    for (const item of SAMPLE_ALUMNI) {
      // Create Base User Document
      await setDoc(doc(db, "users", item.uid), {
        email: item.email,
        displayName: item.displayName,
        photoURL: item.photoURL,
        role: item.role,
        createdAt: Timestamp.now()
      });

      // Create Alumni Profile Document
      await setDoc(doc(db, "alumniProfiles", item.uid), {
        ...item.profile,
        updatedAt: Timestamp.now()
      });
    }

    // 2. Seed Opportunities
    for (const item of SAMPLE_OPPORTUNITIES) {
      await setDoc(doc(db, "opportunities", item.opportunityId), {
        ...item,
        createdAt: Timestamp.now()
      });
    }

    // 3. Seed Announcements
    for (const item of SAMPLE_ANNOUNCEMENTS) {
      await setDoc(doc(db, "announcements", item.announcementId), {
        ...item,
        postedBy: adminUid,
        createdAt: Timestamp.now()
      });
    }

    console.log("Seeding completed successfully.");
  } catch (error) {
    console.error("Error seeding data:", error);
  }
}
