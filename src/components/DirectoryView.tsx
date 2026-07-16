import React, { useState, useEffect } from "react";
import { 
  Search, 
  MapPin, 
  GraduationCap, 
  Briefcase, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Clock,
  Sparkles,
  ArrowLeft,
  MessageSquarePlus,
  Send,
  Loader
} from "lucide-react";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  Timestamp, 
  onSnapshot 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserDoc, AlumniProfileDoc, MentorshipRequestDoc } from "../types";

interface DirectoryViewProps {
  currentUserId: string;
  currentUserRole: "student" | "alumnus" | "admin";
  schoolId: string;
}

interface AlumniWithUser {
  uid: string;
  user: UserDoc;
  profile: AlumniProfileDoc;
}

export default function DirectoryView({ currentUserId, currentUserRole, schoolId }: DirectoryViewProps) {
  const [alumni, setAlumni] = useState<AlumniWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlumni, setSelectedAlumni] = useState<AlumniWithUser | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [uniFilter, setUniFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [mentorOnly, setMentorOnly] = useState(false);

  // Mentorship Request State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [existingRequest, setExistingRequest] = useState<MentorshipRequestDoc | null>(null);
  const [activeRequestsCount, setActiveRequestsCount] = useState(0);

  // Unique countries and graduation years for dropdowns
  const countries = ["United States", "Canada", "United Kingdom", "Germany", "France", "Japan", "Australia", "United Arab Emirates", "Ireland"];
  const years = Array.from({ length: 30 }, (_, i) => String(2026 - i));

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);

    // Listen to approved alumni profiles for this school (or all of them if admin)
    const alumniQuery = currentUserRole === "admin"
      ? query(collection(db, "alumniProfiles"), where("schoolId", "==", schoolId))
      : query(collection(db, "alumniProfiles"), where("schoolId", "==", schoolId), where("approvalStatus", "==", "approved"));

    const unsubAlumni = onSnapshot(
      alumniQuery,
      async (snapshot) => {
        try {
          const profilesList: AlumniProfileDoc[] = [];
          snapshot.forEach((docSnap) => {
            profilesList.push(docSnap.data() as AlumniProfileDoc);
          });

          // If current user is alumnus, fetch their own profile to see if they are in the directory/status
          const hasSelf = profilesList.some(p => p.userId === currentUserId);
          if (currentUserRole === "alumnus" && !hasSelf) {
            const selfDocSnap = await getDoc(doc(db, "alumniProfiles", `${schoolId}_${currentUserId}`));
            if (selfDocSnap.exists()) {
              profilesList.push(selfDocSnap.data() as AlumniProfileDoc);
            }
          }

          // Fetch matching base user docs for each profile based on profile's userId
          const userPromises = profilesList.map(async (profile) => {
            const userDocSnap = await getDoc(doc(db, "users", profile.userId));
            if (userDocSnap.exists()) {
              const rawProfile = profile as any;
              const journey = {
                story: rawProfile.journey?.story || rawProfile.journey?.whatTheyStudied || "",
                whatHelpedSucceed: rawProfile.journey?.whatHelpedSucceed || rawProfile.journey?.whatHelpedMost || "",
                biggestChallenge: rawProfile.journey?.biggestChallenge || rawProfile.journey?.howTheyGotThere || "",
                startAgain: rawProfile.journey?.startAgain || rawProfile.journey?.whatTheyWouldDoDifferently || "",
                adviceForStudents: rawProfile.journey?.adviceForStudents || "",
                recommendedResources: rawProfile.journey?.recommendedResources || "",
                funFact: rawProfile.journey?.funFact || ""
              };
              const mappedProfile: AlumniProfileDoc = {
                ...rawProfile,
                journey
              };
              return {
                uid: profile.userId,
                user: userDocSnap.data() as UserDoc,
                profile: mappedProfile
              };
            }
            return null;
          });

          const resolvedAlumni = (await Promise.all(userPromises)).filter(
            (item): item is AlumniWithUser => item !== null
          );

          setAlumni(resolvedAlumni);
          setLoading(false);
        } catch (error) {
          console.error("Error loading alumni directory:", error);
          setLoading(false);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "alumniProfiles");
      }
    );

    // If student, listen to student's active requests count (pending or accepted) in this school to enforce limit of 5
    if (currentUserRole === "student") {
      const unsubRequestsCount = onSnapshot(
        query(
          collection(db, "mentorshipRequests"),
          where("schoolId", "==", schoolId),
          where("studentId", "==", currentUserId)
        ),
        (snapshot) => {
          let count = 0;
          snapshot.forEach((doc) => {
            const data = doc.data() as MentorshipRequestDoc;
            if (data.status === "pending" || data.status === "accepted") {
              count++;
            }
          });
          setActiveRequestsCount(count);
        }
      );
      return () => {
        unsubAlumni();
        unsubRequestsCount();
      };
    }

    return () => {
      unsubAlumni();
    };
  }, [currentUserId, currentUserRole, schoolId]);

  // If a profile is selected, fetch any existing requests between this student and the selected alumnus in this school
  useEffect(() => {
    if (!selectedAlumni || currentUserRole !== "student" || !schoolId) return;

    setExistingRequest(null);

    const q = query(
      collection(db, "mentorshipRequests"),
      where("schoolId", "==", schoolId),
      where("studentId", "==", currentUserId),
      where("alumnusId", "==", selectedAlumni.uid)
    );

    const unsubRequestCheck = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        // Resolve the most relevant request
        let latestRequest = snapshot.docs[0].data() as MentorshipRequestDoc;
        latestRequest.requestId = snapshot.docs[0].id;
        snapshot.docs.forEach((doc) => {
          const req = doc.data() as MentorshipRequestDoc;
          if (req.status === "pending" || req.status === "accepted") {
            latestRequest = req;
            latestRequest.requestId = doc.id;
          }
        });
        setExistingRequest(latestRequest);
      } else {
        setExistingRequest(null);
      }
    });

    return () => unsubRequestCheck();
  }, [selectedAlumni, currentUserId, currentUserRole, schoolId]);

  const handleOpenRequestModal = () => {
    if (activeRequestsCount >= 5) {
      alert("You may have at most 5 active (pending or accepted) mentorship requests at once. Please resolve or cancel an existing request.");
      return;
    }
    setRequestMessage(`Hi ${selectedAlumni?.user.displayName}, I'm interested in your journey and career path. Could I ask you a few questions about your experience in ${selectedAlumni?.profile.degree}?`);
    setIsRequestModalOpen(true);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlumni || sendingRequest || !schoolId) return;

    if (requestMessage.trim().length > 1000) {
      alert("Message must be 1000 characters or fewer.");
      return;
    }

    setSendingRequest(true);
    try {
      const requestId = `${schoolId}_${currentUserId}_${selectedAlumni.uid}_${Date.now()}`;
      const payload: MentorshipRequestDoc = {
        studentId: currentUserId,
        alumnusId: selectedAlumni.uid,
        message: requestMessage.trim(),
        status: "pending",
        createdAt: Timestamp.now(),
        respondedAt: null,
        schoolId: schoolId
      } as any;

      await setDoc(doc(db, "mentorshipRequests", requestId), payload);
      setIsRequestModalOpen(false);
      alert("Your mentorship request has been sent successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "mentorshipRequests");
    } finally {
      setSendingRequest(false);
    }
  };

  // Filter logic
  const filteredAlumni = alumni.filter((al) => {
    // 1. Search Query (Name, Degree, Job title)
    const matchesSearch = 
      al.user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      al.profile.degree.toLowerCase().includes(searchQuery.toLowerCase()) ||
      al.profile.currentJobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      al.profile.currentCompany.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. University Filter (Text input)
    const matchesUni = !uniFilter || al.profile.university.toLowerCase().includes(uniFilter.toLowerCase());

    // 3. Country Filter (Dropdown)
    const matchesCountry = !countryFilter || al.profile.country === countryFilter;

    // 4. Graduation Year Filter (Dropdown)
    const matchesYear = !yearFilter || String(al.profile.graduationYear) === yearFilter;

    // 5. Available to mentor toggle
    const matchesMentor = !mentorOnly || al.profile.availableToMentor;

    return matchesSearch && matchesUni && matchesCountry && matchesYear && matchesMentor;
  });

  if (selectedAlumni) {
    // PROFILE PAGE VIEW
    const p = selectedAlumni.profile;
    const u = selectedAlumni.user;

    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedAlumni(null)}
          className="flex items-center space-x-2 text-stone-500 hover:text-stone-800 transition-colors font-mono font-bold text-xs uppercase tracking-wider"
          id="back-to-directory"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Directory</span>
        </button>

        {/* Hero Card */}
        <div className="bg-white rounded-none border border-stone-200 p-6 md:p-8 shadow-none">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start space-x-5">
              <img
                src={u.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120"}
                alt={u.displayName}
                referrerPolicy="no-referrer"
                className="w-20 h-20 rounded-none object-cover border border-stone-200 bg-stone-50 shrink-0"
              />
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl md:text-3xl font-serif font-bold text-stone-900 leading-tight">{u.displayName}</h2>
                  {p.availableToMentor ? (
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded-none inline-flex items-center space-x-1 uppercase tracking-wider">
                      <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping mr-1"></span>
                      <span>Available</span>
                    </span>
                  ) : (
                    <span className="bg-stone-100 text-stone-600 border border-stone-200 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-none inline-flex items-center uppercase tracking-wider">
                      Unavailable
                    </span>
                  )}
                </div>
                <p className="text-stone-800 font-serif italic text-base md:text-lg">
                  {p.currentJobTitle} <span className="text-stone-400 font-sans not-italic font-normal">at</span> {p.currentCompany}
                </p>
                <div className="flex flex-wrap gap-y-1 gap-x-4 text-xs text-stone-500 pt-1 font-mono">
                  <span className="flex items-center space-x-1">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>{p.degree} ({p.graduationYear})</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{p.university}, {p.country}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Mentorship request button action */}
            {currentUserRole === "student" && selectedAlumni.uid !== currentUserId && (
              <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto shrink-0">
                {!existingRequest ? (
                  p.availableToMentor ? (
                    <button
                      onClick={handleOpenRequestModal}
                      id="btn-request-mentorship"
                      className="bg-[#1C1A17] hover:bg-[#2E2B27] text-white font-mono font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-none shadow-none transition-all text-center flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                      <span>Request Mentorship</span>
                    </button>
                  ) : (
                    <p className="text-xs text-stone-500 italic bg-stone-50 px-4 py-2 rounded-none border border-stone-200 text-center font-serif">
                      This alumnus isn't available to chat right now.
                    </p>
                  )
                ) : (
                  <div className="flex flex-col items-stretch md:items-end">
                    {existingRequest.status === "pending" && (
                      <span className="bg-amber-50 text-amber-900 border border-amber-200 text-xs font-mono font-bold px-4 py-2.5 rounded-none inline-flex items-center justify-center space-x-2">
                        <Clock className="w-4 h-4 text-amber-700 animate-pulse" />
                        <span>Request Pending</span>
                      </span>
                    )}
                    {existingRequest.status === "accepted" && (
                      <span className="bg-emerald-50/80 text-emerald-900 border border-emerald-200 text-xs font-mono font-bold px-4 py-2.5 rounded-none inline-flex items-center justify-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-emerald-700" />
                        <span>Request Accepted</span>
                      </span>
                    )}
                    {existingRequest.status === "declined" && (
                      <p className="text-xs text-stone-500 italic bg-stone-50 px-4 py-2 rounded-none border border-stone-200 text-center font-serif">
                        This alumnus isn't available to chat right now.
                      </p>
                    )}
                  </div>
                )}
                {activeRequestsCount >= 5 && !existingRequest && p.availableToMentor && (
                  <span className="text-[10px] text-red-700 text-center md:text-right font-mono font-semibold uppercase tracking-wider">
                    Active limit reached (5 max)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Journey Sections */}
        <div className="space-y-6 pt-2">
          <div className="border-b border-stone-200 pb-2">
            <h3 className="text-xl font-serif font-bold text-stone-900">Curated Interview Profile</h3>
            <p className="text-xs text-stone-500">Read about their school memories, professional milestones, and reflective advice.</p>
          </div>
          
          <div className="space-y-6">
            {/* Question 1 */}
            <div className="bg-white border border-stone-200 p-6 rounded-none space-y-3 shadow-none">
              <div className="flex items-center space-x-2.5 text-stone-800 border-b border-stone-100 pb-2">
                <span className="flex items-center justify-center w-5 h-5 bg-stone-900 text-white font-mono text-[10px] font-bold">1</span>
                <h4 className="font-serif font-bold text-xs uppercase tracking-wide text-stone-500">Tell us your story</h4>
              </div>
              <p className="text-stone-800 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {p.journey.story}
              </p>
            </div>

            {/* Question 2 */}
            <div className="bg-white border border-stone-200 p-6 rounded-none space-y-3 shadow-none">
              <div className="flex items-center space-x-2.5 text-stone-800 border-b border-stone-100 pb-2">
                <span className="flex items-center justify-center w-5 h-5 bg-stone-900 text-white font-mono text-[10px] font-bold">2</span>
                <h4 className="font-serif font-bold text-xs uppercase tracking-wide text-stone-500">What helped you succeed?</h4>
              </div>
              <p className="text-stone-800 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {p.journey.whatHelpedSucceed}
              </p>
            </div>

            {/* Question 3 */}
            <div className="bg-white border border-stone-200 p-6 rounded-none space-y-3 shadow-none">
              <div className="flex items-center space-x-2.5 text-stone-800 border-b border-stone-100 pb-2">
                <span className="flex items-center justify-center w-5 h-5 bg-stone-900 text-white font-mono text-[10px] font-bold">3</span>
                <h4 className="font-serif font-bold text-xs uppercase tracking-wide text-stone-500">Biggest challenge</h4>
              </div>
              <p className="text-stone-800 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {p.journey.biggestChallenge}
              </p>
            </div>

            {/* Question 4 */}
            <div className="bg-white border border-stone-200 p-6 rounded-none space-y-3 shadow-none">
              <div className="flex items-center space-x-2.5 text-stone-800 border-b border-stone-100 pb-2">
                <span className="flex items-center justify-center w-5 h-5 bg-stone-900 text-white font-mono text-[10px] font-bold">4</span>
                <h4 className="font-serif font-bold text-xs uppercase tracking-wide text-stone-500">If you could start again...</h4>
              </div>
              <p className="text-stone-800 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {p.journey.startAgain}
              </p>
            </div>

            {/* Question 5 */}
            <div className="bg-stone-50 border border-stone-200 border-l-4 border-l-amber-600 p-6 rounded-none space-y-3 shadow-none">
              <div className="flex items-center space-x-2.5 text-amber-800 border-b border-amber-100 pb-2">
                <span className="flex items-center justify-center w-5 h-5 bg-stone-900 text-white font-mono text-[10px] font-bold">5</span>
                <h4 className="font-serif font-bold text-xs uppercase tracking-wide text-amber-800">Advice for current students</h4>
              </div>
              <p className="text-stone-900 text-sm font-serif italic font-medium leading-relaxed whitespace-pre-wrap">
                "{p.journey.adviceForStudents}"
              </p>
            </div>

            {/* Question 6 */}
            <div className="bg-white border border-stone-200 p-6 rounded-none space-y-3 shadow-none">
              <div className="flex items-center space-x-2.5 text-stone-800 border-b border-stone-100 pb-2">
                <span className="flex items-center justify-center w-5 h-5 bg-stone-900 text-white font-mono text-[10px] font-bold">6</span>
                <h4 className="font-serif font-bold text-xs uppercase tracking-wide text-stone-500">Resources you recommend</h4>
              </div>
              <p className="text-stone-800 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {p.journey.recommendedResources}
              </p>
            </div>

            {/* Question 7 */}
            <div className="bg-white border border-stone-200 p-6 rounded-none space-y-3 shadow-none">
              <div className="flex items-center space-x-2.5 text-stone-800 border-b border-stone-100 pb-2">
                <span className="flex items-center justify-center w-5 h-5 bg-stone-900 text-white font-mono text-[10px] font-bold">7</span>
                <h4 className="font-serif font-bold text-xs uppercase tracking-wide text-stone-500">Fun fact</h4>
              </div>
              <p className="text-stone-800 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {p.journey.funFact}
              </p>
            </div>
          </div>
        </div>

        {/* Modal for Mentorship Request */}
        {isRequestModalOpen && (
          <div className="fixed inset-0 bg-black/65 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-none max-w-lg w-full border border-stone-200 p-6 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-stone-100 pb-3">
                <h4 className="text-lg font-serif font-bold text-stone-900">Request Mentorship</h4>
                <button 
                  onClick={() => setIsRequestModalOpen(false)}
                  className="text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center space-x-3 bg-stone-50 p-4 rounded-none border border-stone-200">
                <img
                  src={u.photoURL}
                  alt={u.displayName}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-none object-cover border border-stone-200"
                />
                <div>
                  <p className="text-sm font-serif font-bold text-stone-900">{u.displayName}</p>
                  <p className="text-xs text-stone-500 font-mono">{p.currentJobTitle} at {p.currentCompany}</p>
                </div>
              </div>

              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                    Your Message
                  </label>
                  <p className="text-[11px] text-stone-400 leading-normal">
                    Write a thoughtful message describing why you'd like to connect. Be respectful and clear.
                  </p>
                  <textarea
                    required
                    maxLength={1000}
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    rows={6}
                    placeholder="Describe your background and what you hope to learn..."
                    className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none p-3 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-stone-400 px-1 pt-1">
                    <span>Active requests: {activeRequestsCount}/5</span>
                    <span>{requestMessage.length}/1000 characters</span>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRequestModalOpen(false)}
                    className="px-4 py-2.5 border border-stone-200 text-stone-600 rounded-none text-xs font-mono font-bold uppercase tracking-wider hover:bg-stone-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingRequest}
                    id="submit-request-btn"
                    className="bg-[#1C1A17] hover:bg-[#2E2B27] text-white font-mono font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-none shadow-none inline-flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                  >
                    {sendingRequest ? (
                      <>
                        <Loader className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Request</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // DIRECTORY BROWSE VIEW
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">Alumni Directory</h2>
        <p className="text-sm text-stone-500">Connect with approved alumni of your network to request mentorship and learn from their journeys.</p>
      </div>

      {/* Filters Card */}
      <div className="bg-white border border-stone-200 rounded-none p-5 shadow-none space-y-4">
        {/* Row 1: Search & University text filter */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search by Name, Degree, or Job Title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-50 text-stone-900 text-sm rounded-none pl-10 pr-4 py-3 border border-stone-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>
          <div className="relative">
            <GraduationCap className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Filter by University..."
              value={uniFilter}
              onChange={(e) => setUniFilter(e.target.value)}
              className="w-full bg-stone-50 text-stone-900 text-sm rounded-none pl-10 pr-4 py-3 border border-stone-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>
        </div>

        {/* Row 2: Country, Graduation Year, & Mentor Only Toggle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-3 border-t border-stone-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="bg-stone-50 text-stone-700 text-xs font-mono rounded-none px-3 py-2.5 border border-stone-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
            >
              <option value="">All Countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="bg-stone-50 text-stone-700 text-xs font-mono rounded-none px-3 py-2.5 border border-stone-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
            >
              <option value="">All Graduation Years</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <label className="flex items-center space-x-2 text-xs font-mono font-semibold uppercase tracking-wider text-stone-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={mentorOnly}
                onChange={(e) => setMentorOnly(e.target.checked)}
                className="w-4 h-4 text-amber-700 rounded-none border-stone-300 focus:ring-stone-500 cursor-pointer"
              />
              <span>Available to Mentor only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Grid Results */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader className="w-8 h-8 text-stone-300 animate-spin" />
        </div>
      ) : filteredAlumni.length === 0 ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-none p-12 text-center">
          <AlertCircle className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-800 font-serif font-bold text-base">No alumni match these filters yet.</p>
          <p className="text-stone-400 text-xs mt-1">Try broadening your search criteria or resetting filters.</p>
          {(searchQuery || uniFilter || countryFilter || yearFilter || mentorOnly) && (
            <button
              onClick={() => {
                setSearchQuery("");
                setUniFilter("");
                setCountryFilter("");
                setYearFilter("");
                setMentorOnly(false);
              }}
              className="mt-4 px-4 py-2 border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 rounded-none text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAlumni.map((al) => {
            const p = al.profile;
            const u = al.user;

            return (
              <div
                key={al.uid}
                onClick={() => setSelectedAlumni(al)}
                className="group bg-white border border-stone-200 rounded-none p-5 hover:border-stone-400 hover:shadow-sm transition-all duration-150 cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center space-x-3.5">
                    <img
                      src={u.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80"}
                      alt={u.displayName}
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-none object-cover border border-stone-100 bg-stone-50 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-serif font-bold text-stone-900 group-hover:text-amber-800 transition-colors truncate">
                        {u.displayName}
                      </h4>
                      <p className="text-xs text-stone-500 truncate">{p.currentJobTitle}</p>
                      <p className="text-[10px] text-stone-400 truncate">{p.currentCompany}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-stone-600 pt-3.5 border-t border-stone-100 font-mono">
                    <div className="flex items-center space-x-2 truncate">
                      <GraduationCap className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{p.degree} ({p.graduationYear})</span>
                    </div>
                    <div className="flex items-center space-x-2 truncate">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{p.university}, {p.country}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-stone-100 flex items-center justify-between">
                  {p.availableToMentor ? (
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 text-[9px] font-mono font-bold px-2 py-0.5 rounded-none uppercase tracking-wide inline-flex items-center space-x-1">
                      <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping mr-1"></span>
                      <span>Available</span>
                    </span>
                  ) : (
                    <span className="bg-stone-50 text-stone-400 border border-stone-200 text-[9px] font-mono font-semibold px-2 py-0.5 rounded-none uppercase tracking-wide">
                      Unavailable
                    </span>
                  )}
                  <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-stone-800 group-hover:text-stone-950">
                    View Journey &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
