export interface SchoolDoc {
  id: string;
  name: string;
  logoUrl?: string;
  description: string;
  createdBy: string;
  createdAt: any;
}

export interface MembershipDoc {
  schoolId: string;
  userId: string;
  role: UserRole;
  status: "active" | "pending" | "approved" | "rejected";
  createdAt: any;
}

export type UserRole = "admin" | "alumnus" | "student";

export interface NetworkSettings {
  name: string;
  createdBy: string;
  createdAt: any; // Firestore Timestamp
}

export interface UserDoc {
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  createdAt: any; // Firestore Timestamp
}

export interface AlumniJourney {
  story: string; // Question 1: Tell us your story
  whatHelpedSucceed: string; // Question 2: What helped you succeed?
  biggestChallenge: string; // Question 3: Biggest challenge
  startAgain: string; // Question 4: If you could start again...
  adviceForStudents: string; // Question 5: Advice for current students
  recommendedResources: string; // Question 6: Resources you recommend
  funFact: string; // Question 7: Fun fact
}

export interface AlumniProfileDoc {
  userId?: string;
  schoolId?: string;
  graduationYear: number;
  university: string;
  degree: string;
  currentJobTitle: string;
  currentCompany: string;
  country: string;
  availableToMentor: boolean;
  approvalStatus: "pending" | "approved" | "rejected";
  journey: AlumniJourney;
  updatedAt: any; // Firestore Timestamp;
}

export interface StudentProfileDoc {
  userId?: string;
  schoolId?: string;
  currentClass: string; // required dropdown (Class 7, Class 8, Class 9, Class 10, Class 11, Class 12)
  intendedFieldOfStudy?: string; // optional text
  shortIntroduction?: string; // optional text, ~200 characters limit
}

export interface MentorshipRequestDoc {
  requestId?: string;
  studentId: string;
  alumnusId: string;
  message: string;
  status: "pending" | "accepted" | "declined";
  createdAt: any; // Firestore Timestamp
  respondedAt: any | null; // Firestore Timestamp or null
}

export interface ConversationDoc {
  requestId?: string;
  participantIds: string[];
  lastMessageAt: any; // Firestore Timestamp
}

export interface MessageDoc {
  messageId?: string;
  senderId: string;
  text: string;
  sentAt: any; // Firestore Timestamp
}

export interface OpportunityDoc {
  opportunityId?: string;
  postedBy: string;
  postedByName?: string; // resolved during display
  type: "internship" | "scholarship" | "competition" | "workshop" | "job";
  title: string;
  description: string;
  externalLink: string;
  deadline: any | null; // Firestore Timestamp or null
  createdAt: any; // Firestore Timestamp
}

export interface AnnouncementDoc {
  announcementId?: string;
  postedBy: string;
  title: string;
  description: string;
  eventDate: any | null; // Firestore Timestamp or null
  location: string;
  createdAt: any; // Firestore Timestamp
}
