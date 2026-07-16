import React, { useState, useEffect } from "react";
import { User, GraduationCap, Globe, Check, Info, Loader, BookOpen, Star, HelpCircle, Heart, Compass, ShieldAlert } from "lucide-react";
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
  const [currentClass, setCurrentClass] = useState("Class 10");
  const [intendedFieldOfStudy, setIntendedFieldOfStudy] = useState("");
  const [shortIntroduction, setShortIntroduction] = useState("");

  // Alumnus Profile State
  const [graduationYear, setGraduationYear] = useState<number>(2026);
  const [university, setUniversity] = useState("Boston Institute of Technology");
  const [degree, setDegree] = useState("");
  const [currentJobTitle, setCurrentJobTitle] = useState("");
  const [currentCompany, setCurrentCompany] = useState("");
  const [country, setCountry] = useState("United States");
  const [availableToMentor, setAvailableToMentor] = useState(true);
  const [approvalStatus, setApprovalStatus] = useState<"pending" | "approved" | "rejected">("pending");

  // Journey States (Alumni 7 Questions)
  const [story, setStory] = useState("");
  const [whatHelpedSucceed, setWhatHelpedSucceed] = useState("");
  const [biggestChallenge, setBiggestChallenge] = useState("");
  const [startAgain, setStartAgain] = useState("");
  const [adviceForStudents, setAdviceForStudents] = useState("");
  const [recommendedResources, setRecommendedResources] = useState("");
  const [funFact, setFunFact] = useState("");

  const countries = ["Bangladesh", "United States", "Canada", "United Kingdom", "Germany", "France", "Japan", "Australia", "United Arab Emirates", "Ireland", "Sweden", "Singapore", "Malaysia", "India"];
  
  const classesList = [
    "Class 7",
    "Class 8",
    "Class 9",
    "Class 10",
    "Class 11",
    "Class 12"
  ];

  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

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
            const pData = pSnap.data() as any;
            setCurrentClass(pData.currentClass || pData.currentStage || "Class 10");
            setIntendedFieldOfStudy(pData.intendedFieldOfStudy || pData.interestArea || "");
            setShortIntroduction(pData.shortIntroduction || "");
          }
        } else if (currentUserRole === "alumnus") {
          const pSnap = await getDoc(doc(db, "alumniProfiles", `${schoolId}_${currentUserId}`));
          if (pSnap.exists()) {
            const pData = pSnap.data() as any;
            setGraduationYear(pData.graduationYear || 2026);
            setUniversity(pData.university || "");
            setDegree(pData.degree || "");
            setCurrentJobTitle(pData.currentJobTitle || "");
            setCurrentCompany(pData.currentCompany || "");
            setCountry(pData.country || "Bangladesh");
            setAvailableToMentor(pData.availableToMentor !== false);
            setApprovalStatus(pData.approvalStatus || "pending");
            
            if (pData.journey) {
              setStory(pData.journey.story || pData.journey.whatTheyStudied || "");
              setWhatHelpedSucceed(pData.journey.whatHelpedSucceed || pData.journey.whatHelpedMost || "");
              setBiggestChallenge(pData.journey.biggestChallenge || pData.journey.howTheyGotThere || "");
              setStartAgain(pData.journey.startAgain || pData.journey.whatTheyWouldDoDifferently || "");
              setAdviceForStudents(pData.journey.adviceForStudents || "");
              setRecommendedResources(pData.journey.recommendedResources || "");
              setFunFact(pData.journey.funFact || "");
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
      // 1. Update display name in base user document
      const uRef = doc(db, "users", currentUserId);
      const uSnap = await getDoc(uRef);
      if (uSnap.exists()) {
        await updateDoc(uRef, {
          displayName: displayName.trim()
        });
      }

      // 2. Save role-specific profile document
      if (currentUserRole === "student") {
        const payload: StudentProfileDoc = {
          schoolId,
          userId: currentUserId,
          currentClass,
          intendedFieldOfStudy: intendedFieldOfStudy.trim(),
          shortIntroduction: shortIntroduction.trim()
        };
        await setDoc(doc(db, "studentProfiles", `${schoolId}_${currentUserId}`), payload);
      } else if (currentUserRole === "alumnus") {
        const payload: AlumniProfileDoc = {
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
            story: story.trim(),
            whatHelpedSucceed: whatHelpedSucceed.trim(),
            biggestChallenge: biggestChallenge.trim(),
            startAgain: startAgain.trim(),
            adviceForStudents: adviceForStudents.trim(),
            recommendedResources: recommendedResources.trim(),
            funFact: funFact.trim()
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
            : "Update your academic details, contact preferences, and journey story."}
        </p>
      </div>

      {currentUserRole === "alumnus" && approvalStatus === "pending" && !isOnboarding && (
        <div className="bg-amber-50/50 border border-amber-200 rounded-none p-4 flex items-start space-x-3 text-amber-900">
          <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-700" />
          <div className="text-xs space-y-1">
            <p className="font-serif font-bold">Your Profile is Pending Approval</p>
            <p className="leading-relaxed text-stone-700">
              An administrator is currently reviewing your profile. Approved alumni are visible in the directory and can receive mentorship inquiries. You can continue updating your profile fields.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-6">
        
        {/* Card 1: Core details */}
        <div className="bg-white border border-stone-200 rounded-none p-6 md:p-8 shadow-none space-y-4">
          <h3 className="font-serif font-bold text-stone-900 text-sm border-b border-stone-100 pb-2">
            Basic Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                Full Name
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
        </div>

        {currentUserRole === "student" ? (
          /* STUDENT ONLY FIELDS */
          <div className="bg-white border border-stone-200 rounded-none p-6 md:p-8 shadow-none space-y-6">
            <h3 className="font-serif font-bold text-stone-900 text-sm border-b border-stone-100 pb-2">Academic Profile</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                  Current Class <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={currentClass}
                  onChange={(e) => setCurrentClass(e.target.value)}
                  className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
                >
                  {classesList.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <p className="text-[10px] text-stone-400 italic">Select your current school class progression</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                  Intended Field of Study <span className="text-stone-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  maxLength={150}
                  placeholder="e.g. Computer Science, Medicine, Engineering, Business, Law..."
                  value={intendedFieldOfStudy}
                  onChange={(e) => setIntendedFieldOfStudy(e.target.value)}
                  className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                Short Introduction <span className="text-stone-400">(Optional, ~200 characters)</span>
              </label>
              <textarea
                maxLength={200}
                rows={3}
                placeholder="I'm interested in studying Computer Science and hope to learn from alumni who have gone through this journey."
                value={shortIntroduction}
                onChange={(e) => setShortIntroduction(e.target.value)}
                className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none p-3 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
              />
              <div className="flex justify-end text-[10px] font-mono text-stone-400">
                {shortIntroduction.length}/200 characters
              </div>
            </div>
          </div>
        ) : (
          /* ALUMNUS ONLY FIELDS */
          <>
            <div className="bg-white border border-stone-200 rounded-none p-6 md:p-8 shadow-none space-y-6">
              <h3 className="font-serif font-bold text-stone-900 text-sm border-b border-stone-100 pb-2">Professional details</h3>
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
                      max={2035}
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
                  Alma Mater / Higher Education Institution
                </label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  placeholder="e.g. Bangladesh University of Engineering and Technology (BUET), MIT..."
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                />
              </div>

              <div className="p-4 bg-stone-50 border border-stone-200 rounded-none flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <label className="font-serif font-bold text-sm text-stone-950">Available for Mentorship</label>
                  <p className="text-xs text-stone-500">Allow students to view your profile and request friendly guidance.</p>
                </div>
                <input
                  type="checkbox"
                  checked={availableToMentor}
                  onChange={(e) => setAvailableToMentor(e.target.checked)}
                  className="w-5 h-5 text-stone-900 rounded-none border-stone-300 focus:ring-stone-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Journey Interview Sections - 7 Questions */}
            <div className="space-y-6 pt-2">
              <div className="border-b border-stone-200 pb-3">
                <h3 className="font-serif font-bold text-stone-900 text-lg">My Alumni Story Interview</h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Our network profiles read like curated career interviews rather than a corporate résumé. Share your path to help inspire the next generation of students.
                </p>
              </div>

              {/* Question 1 */}
              <div className="bg-white border border-stone-200 rounded-none p-6 space-y-3 shadow-none">
                <div className="flex items-center space-x-2.5 text-stone-800 border-b border-stone-100 pb-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-stone-900 text-white font-mono text-xs font-bold">1</span>
                  <h4 className="font-serif font-bold text-sm">Tell us your story</h4>
                </div>
                <p className="text-xs text-stone-500 leading-snug">
                  Briefly describe your journey after leaving school. You can mention your university, degree, career path, or any important milestones.
                </p>
                <textarea
                  required
                  maxLength={2500}
                  rows={4}
                  placeholder="After leaving school, I decided to study Computer Science. I faced hurdles, but it led me to work as a Software Engineer at..."
                  value={story}
                  onChange={(e) => setStory(e.target.value)}
                  className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none p-3 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
                />
                <div className="flex justify-between items-center text-[10px] font-mono text-stone-400">
                  <span>Aim for 100 - 400 words</span>
                  <span>{getWordCount(story)} words / {story.length} chars</span>
                </div>
              </div>

              {/* Question 2 */}
              <div className="bg-white border border-stone-200 rounded-none p-6 space-y-3 shadow-none">
                <div className="flex items-center space-x-2.5 text-stone-800 border-b border-stone-100 pb-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-stone-900 text-white font-mono text-xs font-bold">2</span>
                  <h4 className="font-serif font-bold text-sm">What helped you succeed?</h4>
                </div>
                <p className="text-xs text-stone-500 leading-snug">
                  What habits, decisions, opportunities or experiences made the biggest difference in your journey?
                </p>
                <textarea
                  required
                  maxLength={2500}
                  rows={4}
                  placeholder="Being proactive, seeking out coding communities early, and devoting time to self-study outside of school hours..."
                  value={whatHelpedSucceed}
                  onChange={(e) => setWhatHelpedSucceed(e.target.value)}
                  className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none p-3 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
                />
                <div className="flex justify-between items-center text-[10px] font-mono text-stone-400">
                  <span>Aim for 100 - 400 words</span>
                  <span>{getWordCount(whatHelpedSucceed)} words / {whatHelpedSucceed.length} chars</span>
                </div>
              </div>

              {/* Question 3 */}
              <div className="bg-white border border-stone-200 rounded-none p-6 space-y-3 shadow-none">
                <div className="flex items-center space-x-2.5 text-stone-800 border-b border-stone-100 pb-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-stone-900 text-white font-mono text-xs font-bold">3</span>
                  <h4 className="font-serif font-bold text-sm">Biggest challenge</h4>
                </div>
                <p className="text-xs text-stone-500 leading-snug">
                  What was one major obstacle you faced, and how did you overcome it?
                </p>
                <textarea
                  required
                  maxLength={2500}
                  rows={4}
                  placeholder="When I first moved to another city for higher education, the cultural shift and academic pressure felt intense, but I..."
                  value={biggestChallenge}
                  onChange={(e) => setBiggestChallenge(e.target.value)}
                  className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none p-3 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
                />
                <div className="flex justify-between items-center text-[10px] font-mono text-stone-400">
                  <span>Aim for 100 - 400 words</span>
                  <span>{getWordCount(biggestChallenge)} words / {biggestChallenge.length} chars</span>
                </div>
              </div>

              {/* Question 4 */}
              <div className="bg-white border border-stone-200 rounded-none p-6 space-y-3 shadow-none">
                <div className="flex items-center space-x-2.5 text-stone-800 border-b border-stone-100 pb-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-stone-900 text-white font-mono text-xs font-bold">4</span>
                  <h4 className="font-serif font-bold text-sm">If you could start again...</h4>
                </div>
                <p className="text-xs text-stone-500 leading-snug">
                  Looking back, what would you do differently if you were still a student?
                </p>
                <textarea
                  required
                  maxLength={2500}
                  rows={4}
                  placeholder="If I could start again, I would focus much more on deep conceptual fundamentals instead of rote-memorizing frameworks..."
                  value={startAgain}
                  onChange={(e) => setStartAgain(e.target.value)}
                  className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none p-3 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
                />
                <div className="flex justify-between items-center text-[10px] font-mono text-stone-400">
                  <span>Aim for 100 - 400 words</span>
                  <span>{getWordCount(startAgain)} words / {startAgain.length} chars</span>
                </div>
              </div>

              {/* Question 5 */}
              <div className="bg-white border border-stone-200 rounded-none p-6 space-y-3 shadow-none">
                <div className="flex items-center space-x-2.5 text-amber-800 border-b border-stone-100 pb-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-stone-900 text-white font-mono text-xs font-bold">5</span>
                  <h4 className="font-serif font-bold text-sm">Advice for current students</h4>
                </div>
                <p className="text-xs text-stone-500 leading-snug">
                  If you had only one piece of advice to give students at this school, what would it be?
                </p>
                <textarea
                  required
                  maxLength={2500}
                  rows={4}
                  placeholder="Never stop asking why. Don't be afraid of asking stupid questions; they are always the fastest shortcut to clarity..."
                  value={adviceForStudents}
                  onChange={(e) => setAdviceForStudents(e.target.value)}
                  className="w-full text-stone-900 bg-[#FCFAF6] border border-stone-200 rounded-none p-3 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
                />
                <div className="flex justify-between items-center text-[10px] font-mono text-stone-400">
                  <span>Aim for 100 - 400 words</span>
                  <span>{getWordCount(adviceForStudents)} words / {adviceForStudents.length} chars</span>
                </div>
              </div>

              {/* Question 6 */}
              <div className="bg-white border border-stone-200 rounded-none p-6 space-y-3 shadow-none">
                <div className="flex items-center space-x-2.5 text-stone-800 border-b border-stone-100 pb-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-stone-900 text-white font-mono text-xs font-bold">6</span>
                  <h4 className="font-serif font-bold text-sm">Resources you recommend</h4>
                </div>
                <p className="text-xs text-stone-500 leading-snug">
                  Are there any books, websites, YouTube channels, courses or communities that genuinely helped you?
                </p>
                <textarea
                  required
                  maxLength={2500}
                  rows={4}
                  placeholder="I highly recommend checking out 'The Pragmatic Programmer' book, Coursera's algorithms courses, and..."
                  value={recommendedResources}
                  onChange={(e) => setRecommendedResources(e.target.value)}
                  className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none p-3 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
                />
                <div className="flex justify-between items-center text-[10px] font-mono text-stone-400">
                  <span>Aim for 100 - 400 words</span>
                  <span>{getWordCount(recommendedResources)} words / {recommendedResources.length} chars</span>
                </div>
              </div>

              {/* Question 7 */}
              <div className="bg-white border border-stone-200 rounded-none p-6 space-y-3 shadow-none">
                <div className="flex items-center space-x-2.5 text-stone-800 border-b border-stone-100 pb-2">
                  <span className="flex items-center justify-center w-6 h-6 bg-stone-900 text-white font-mono text-xs font-bold">7</span>
                  <h4 className="font-serif font-bold text-sm">Fun fact</h4>
                </div>
                <p className="text-xs text-stone-500 leading-snug">
                  Share something interesting about yourself outside academics or work (hobby, sport, travel, travel destination, unusual skill, book, etc.).
                </p>
                <textarea
                  required
                  maxLength={2500}
                  rows={4}
                  placeholder="I love playing standard classical chess and can play completely blindfolded, or I can bake a perfect Neapolitan pizza from scratch..."
                  value={funFact}
                  onChange={(e) => setFunFact(e.target.value)}
                  className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none p-3 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
                />
                <div className="flex justify-between items-center text-[10px] font-mono text-stone-400">
                  <span>Aim for 100 - 400 words</span>
                  <span>{getWordCount(funFact)} words / {funFact.length} chars</span>
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
