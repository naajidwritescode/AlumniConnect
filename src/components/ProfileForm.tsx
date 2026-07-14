import React, { useState, useEffect } from "react";
import { User, GraduationCap, Globe, Check, Info, Loader } from "lucide-react";
import { doc, getDoc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserRole, AlumniProfileDoc, StudentProfileDoc, UserDoc } from "../types";

interface ProfileFormProps {
  currentUserId: string;
  currentUserRole: UserRole;
  currentUserName: string;
  schoolId: string;
  onSaveCompleted?: () => void;
  isOnboarding?: boolean;
}

export default function ProfileForm({ 
  currentUserId, 
  currentUserRole,
  currentUserName,
  schoolId,
  onSaveCompleted,
  isOnboarding = false
}: ProfileFormProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // User Base Doc State
  const [displayName, setDisplayName] = useState(currentUserName);

  // Student Profile State
  const [interestArea, setInterestArea] = useState("");
  const [currentStage, setCurrentStage] = useState("Undergraduate - 1st Year");

  // Alumnus Profile State
  const [graduationYear, setGraduationYear] = useState<number>(2026);
  const [university, setUniversity] = useState("Boston Institute of Technology");
  const [degree, setDegree] = useState("");
  const [currentJobTitle, setCurrentJobTitle] = useState("");
  const [currentCompany, setCurrentCompany] = useState("");
  const [country, setCountry] = useState("United States");
  const [availableToMentor, setAvailableToMentor] = useState(true);
  const [approvalStatus, setApprovalStatus] = useState<"pending" | "approved" | "rejected">("pending");

  // Journey States (Alumni)
  const [whatTheyStudied, setWhatTheyStudied] = useState("");
  const [howTheyGotThere, setHowTheyGotThere] = useState("");
  const [whatHelpedMost, setWhatHelpedMost] = useState("");
  const [whatTheyWouldDoDifferently, setWhatTheyWouldDoDifferently] = useState("");
  const [adviceForStudents, setAdviceForStudents] = useState("");

  const countries = ["United States", "Canada", "United Kingdom", "Germany", "France", "Japan", "Australia", "United Arab Emirates", "Ireland"];
  const stages = [
    "Grade 11 / Junior High",
    "Grade 12 / Senior High",
    "Undergraduate - 1st Year",
    "Undergraduate - 2nd Year",
    "Undergraduate - 3rd Year",
    "Undergraduate - 4th Year",
    "Graduate Student (Master's / PhD)",
    "Postgraduate"
  ];

  useEffect(() => {
    async function loadProfile() {
      if (!schoolId) return;
      try {
        // Load Base User Info
        const uSnap = await getDoc(doc(db, "users", currentUserId));
        if (uSnap.exists()) {
          const uData = uSnap.data() as UserDoc;
          setDisplayName(uData.displayName);
        }

        if (currentUserRole === "student") {
          const pSnap = await getDoc(doc(db, "studentProfiles", `${schoolId}_${currentUserId}`));
          if (pSnap.exists()) {
            const pData = pSnap.data() as StudentProfileDoc;
            setInterestArea(pData.interestArea || "");
            setCurrentStage(pData.currentStage || "Undergraduate - 1st Year");
          }
        } else if (currentUserRole === "alumnus") {
          const pSnap = await getDoc(doc(db, "alumniProfiles", `${schoolId}_${currentUserId}`));
          if (pSnap.exists()) {
            const pData = pSnap.data() as AlumniProfileDoc;
            setGraduationYear(pData.graduationYear || 2026);
            setUniversity(pData.university || "Boston Institute of Technology");
            setDegree(pData.degree || "");
            setCurrentJobTitle(pData.currentJobTitle || "");
            setCurrentCompany(pData.currentCompany || "");
            setCountry(pData.country || "United States");
            setAvailableToMentor(pData.availableToMentor !== false);
            setApprovalStatus(pData.approvalStatus || "pending");
            
            if (pData.journey) {
              setWhatTheyStudied(pData.journey.whatTheyStudied || "");
              setHowTheyGotThere(pData.journey.howTheyGotThere || "");
              setWhatHelpedMost(pData.journey.whatHelpedMost || "");
              setWhatTheyWouldDoDifferently(pData.journey.whatTheyWouldDoDifferently || "");
              setAdviceForStudents(pData.journey.adviceForStudents || "");
            }
          }
        }
        setLoading(false);
      } catch (error) {
        console.error("Error loading profile details:", error);
        setLoading(false);
      }
    }

    loadProfile();
  }, [currentUserId, currentUserRole, schoolId]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !schoolId) return;

    setSaving(true);

    try {
      // 1. Update display name in base user document (keeping role identical to satisfy rules)
      const uRef = doc(db, "users", currentUserId);
      const uSnap = await getDoc(uRef);
      if (uSnap.exists()) {
        await updateDoc(uRef, {
          displayName: displayName.trim()
        });
      }

      // 2. Save role-specific profile document
      if (currentUserRole === "student") {
        const payload: any = {
          schoolId,
          userId: currentUserId,
          interestArea: interestArea.trim(),
          currentStage
        };
        await setDoc(doc(db, "studentProfiles", `${schoolId}_${currentUserId}`), payload);
      } else if (currentUserRole === "alumnus") {
        const payload: any = {
          schoolId,
          userId: currentUserId,
          graduationYear: Number(graduationYear),
          university: university.trim(),
          degree: degree.trim(),
          currentJobTitle: currentJobTitle.trim(),
          currentCompany: currentCompany.trim(),
          country,
          availableToMentor,
          approvalStatus, // maintains existing status (either pending or approved)
          journey: {
            whatTheyStudied: whatTheyStudied.trim(),
            howTheyGotThere: howTheyGotThere.trim(),
            whatHelpedMost: whatHelpedMost.trim(),
            whatTheyWouldDoDifferently: whatTheyWouldDoDifferently.trim(),
            adviceForStudents: adviceForStudents.trim()
          },
          updatedAt: Timestamp.now()
        };
        await setDoc(doc(db, "alumniProfiles", `${schoolId}_${currentUserId}`), payload);
      }

      alert("Profile updated successfully!");
      if (onSaveCompleted) onSaveCompleted();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, currentUserRole === "student" ? "studentProfiles" : "alumniProfiles");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader className="w-8 h-8 text-stone-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">
          {isOnboarding ? "Complete Your Profile Setup" : "My Profile settings"}
        </h2>
        <p className="text-sm text-stone-500">
          {isOnboarding 
            ? "Enter your details to register on the network and start connecting." 
            : "Update your professional details, contact preferences, and journey story."}
        </p>
      </div>

      {currentUserRole === "alumnus" && approvalStatus === "pending" && !isOnboarding && (
        <div className="bg-amber-50/50 border border-amber-200 rounded-none p-4 flex items-start space-x-3 text-amber-900">
          <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-700" />
          <div className="text-xs space-y-1">
            <p className="font-serif font-bold">Your Profile is Pending Approval</p>
            <p className="leading-relaxed text-stone-700">
              An administrator is currently reviewing your journey. Approved alumni are visible in the directory and can receive mentorship inquiries. You can continue updating your profile fields.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="bg-white border border-stone-200 rounded-none p-6 md:p-8 shadow-none space-y-6">
        {/* Core fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
              Your Full Name
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
              Email Address (Google Identity)
            </label>
            <input
              type="email"
              disabled
              value={currentUserId ? "Verified Gmail Address" : ""}
              placeholder="Your email address"
              className="w-full text-stone-400 bg-stone-100 border border-stone-200 rounded-none px-3 py-2 text-sm cursor-not-allowed font-mono"
            />
          </div>
        </div>

        {currentUserRole === "student" ? (
          /* STUDENT ONLY FIELDS */
          <div className="space-y-4 pt-4 border-t border-stone-200">
            <h3 className="font-serif font-bold text-stone-900 text-sm">Academic Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                  Academic Interest Area
                </label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  placeholder="e.g. Computer Science, Mechanical Engineering, Pre-Med"
                  value={interestArea}
                  onChange={(e) => setInterestArea(e.target.value)}
                  className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                  Current Educational Stage
                </label>
                <select
                  value={currentStage}
                  onChange={(e) => setCurrentStage(e.target.value)}
                  className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-mono"
                >
                  {stages.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ) : (
          /* ALUMNUS ONLY FIELDS */
          <>
            <div className="space-y-4 pt-4 border-t border-stone-200">
              <h3 className="font-serif font-bold text-stone-900 text-sm">Professional details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                    Degree Obtained
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={150}
                    placeholder="e.g. B.S. Computer Science"
                    value={degree}
                    onChange={(e) => setDegree(e.target.value)}
                    className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                      Graduation Year
                    </label>
                    <input
                      type="number"
                      required
                      min={1970}
                      max={2030}
                      value={graduationYear}
                      onChange={(e) => setGraduationYear(Number(e.target.value))}
                      className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                      Country of Residence
                    </label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-mono"
                    >
                      {countries.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                    Current Job Title
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={150}
                    placeholder="e.g. Senior Product Designer, Backend Engineer"
                    value={currentJobTitle}
                    onChange={(e) => setCurrentJobTitle(e.target.value)}
                    className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                    Current Employer / Company
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={150}
                    placeholder="e.g. Stripe, NASA, Freelance"
                    value={currentCompany}
                    onChange={(e) => setCurrentCompany(e.target.value)}
                    className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                  Alma Mater School Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  placeholder="e.g. Boston Institute of Technology"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                />
              </div>

              <div className="p-4 bg-stone-50 border border-stone-200 rounded-none flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <label className="font-serif font-bold text-sm text-stone-950">Available for Mentorship</label>
                  <p className="text-xs text-stone-500">Allow students to search you and send structured connection requests.</p>
                </div>
                <input
                  type="checkbox"
                  checked={availableToMentor}
                  onChange={(e) => setAvailableToMentor(e.target.checked)}
                  className="w-5 h-5 text-stone-900 rounded-none border-stone-300 focus:ring-stone-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Journey Fields */}
            <div className="space-y-4 pt-6 border-t border-stone-200">
              <h3 className="font-serif font-bold text-stone-900 text-sm">Your Professional Journey Story</h3>
              <p className="text-xs text-stone-500 leading-snug">
                Your journey replaces a generic resume with structured experiences. Answer these 4 simple prompts to guide mentees who want to walk the same path.
              </p>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-serif font-bold text-stone-700">
                    1. What did you study, and how did you get to where you are now?
                  </label>
                  <textarea
                    required
                    maxLength={1000}
                    rows={3}
                    placeholder="Briefly describe your college majors, early work placements, or technical pivots..."
                    value={whatTheyStudied}
                    onChange={(e) => setWhatTheyStudied(e.target.value)}
                    className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none p-3 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
                  />
                  <span className="block text-right text-[10px] font-mono text-stone-400">{whatTheyStudied.length}/1000</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-serif font-bold text-stone-700">
                    2. What helped you most along the way?
                  </label>
                  <textarea
                    required
                    maxLength={1000}
                    rows={3}
                    placeholder="Specific skills, clubs, side-projects, open-source work, or teachers..."
                    value={whatHelpedMost}
                    onChange={(e) => setWhatHelpedMost(e.target.value)}
                    className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none p-3 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
                  />
                  <span className="block text-right text-[10px] font-mono text-stone-400">{whatHelpedMost.length}/1000</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-serif font-bold text-stone-700">
                    3. What would you do differently?
                  </label>
                  <textarea
                    required
                    maxLength={1000}
                    rows={3}
                    placeholder="Mistakes, missed modules, things you over-focused on, or things you would skipped..."
                    value={whatTheyWouldDoDifferently}
                    onChange={(e) => setWhatTheyWouldDoDifferently(e.target.value)}
                    className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none p-3 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
                  />
                  <span className="block text-right text-[10px] font-mono text-stone-400">{whatTheyWouldDoDifferently.length}/1000</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-serif font-bold text-stone-700">
                    4. One piece of advice for a student following this path?
                  </label>
                  <textarea
                    required
                    maxLength={1000}
                    rows={3}
                    placeholder="Your absolute best advice for students wanting to follow your career direction..."
                    value={adviceForStudents}
                    onChange={(e) => setAdviceForStudents(e.target.value)}
                    className="w-full text-stone-900 bg-[#FCFAF6] border border-stone-200 rounded-none p-3 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
                  />
                  <span className="block text-right text-[10px] font-mono text-stone-400">{adviceForStudents.length}/1000</span>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="pt-4 border-t border-stone-200 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            id="save-profile-btn"
            className="bg-[#1C1A17] hover:bg-[#2E2B27] text-white font-mono text-xs uppercase tracking-wider px-6 py-3 rounded-none shadow-none disabled:opacity-40 inline-flex items-center space-x-2 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader className="w-4 h-4 animate-spin text-stone-400" />
                <span>Saving Details...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-amber-500" />
                <span>{isOnboarding ? "Complete Registration" : "Save Changes"}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
