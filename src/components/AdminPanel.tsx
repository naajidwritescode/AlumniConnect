import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, 
  Users, 
  CheckCircle, 
  XCircle, 
  Settings, 
  Megaphone, 
  TrendingUp, 
  UserCheck, 
  FileText,
  Loader,
  AlertCircle
} from "lucide-react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc, 
  updateDoc, 
  setDoc,
  getDocs 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserDoc, AlumniProfileDoc } from "../types";

interface AdminPanelProps {
  currentUserId: string;
  networkName: string;
  setNetworkName: (name: string) => void;
  activeSection: "manage-alumni" | "settings";
  schoolId: string;
}

interface AdminAlumniWithUser {
  uid: string;
  user: UserDoc;
  profile: AlumniProfileDoc;
}

export default function AdminPanel({ 
  currentUserId, 
  networkName, 
  setNetworkName,
  activeSection,
  schoolId
}: AdminPanelProps) {
  const [alumni, setAlumni] = useState<AdminAlumniWithUser[]>([]);
  const [studentsCount, setStudentsCount] = useState(0);
  const [mentorshipsCount, setMentorshipsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Settings form
  const [settingsName, setSettingsName] = useState(networkName);
  const [savingSettings, setSavingSettings] = useState(false);

  // Selected alumnus journey drawer/modal
  const [selectedReviewAlumni, setSelectedReviewAlumni] = useState<AdminAlumniWithUser | null>(null);

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);

    // 1. Listen to ALL alumni profiles for this school
    const unsubAlumni = onSnapshot(
      query(collection(db, "alumniProfiles"), where("schoolId", "==", schoolId)),
      async (snapshot) => {
        try {
          const profilesList: { docId: string; profile: AlumniProfileDoc }[] = [];
          snapshot.forEach((docSnap) => {
            profilesList.push({
              docId: docSnap.id,
              profile: docSnap.data() as AlumniProfileDoc
            });
          });

          // Fetch user info for each alumnus profile based on their userId
          const userPromises = profilesList.map(async (item) => {
            const uSnap = await getDoc(doc(db, "users", item.profile.userId));
            if (uSnap.exists()) {
              const rawProfile = item.profile as any;
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
                uid: item.profile.userId,
                user: uSnap.data() as UserDoc,
                profile: mappedProfile
              };
            }
            return null;
          });

          const resolved = (await Promise.all(userPromises)).filter(
            (item): item is AdminAlumniWithUser => item !== null
          );

          setAlumni(resolved);
          setLoading(false);
        } catch (error) {
          console.error("Error loading alumni lists for admin:", error);
          setLoading(false);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "alumniProfiles");
      }
    );

    // 2. Listen to student count from memberships
    const unsubStudents = onSnapshot(
      query(collection(db, "memberships"), where("schoolId", "==", schoolId), where("role", "==", "student")),
      (snapshot) => {
        setStudentsCount(snapshot.size);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "memberships");
      }
    );

    // 3. Listen to active mentorships count for this school
    const unsubMentorships = onSnapshot(
      query(collection(db, "mentorshipRequests"), where("schoolId", "==", schoolId), where("status", "==", "accepted")),
      (snapshot) => {
        setMentorshipsCount(snapshot.size);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "mentorshipRequests");
      }
    );

    return () => {
      unsubAlumni();
      unsubStudents();
      unsubMentorships();
    };
  }, [schoolId]);

  const handleApproveProfile = async (userId: string) => {
    try {
      await updateDoc(doc(db, "alumniProfiles", `${schoolId}_${userId}`), {
        approvalStatus: "approved"
      });
      await updateDoc(doc(db, "memberships", `${schoolId}_${userId}`), {
        status: "active"
      });
      alert("Alumni profile approved successfully!");
      setSelectedReviewAlumni(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `alumniProfiles/${schoolId}_${userId}`);
    }
  };

  const handleRejectProfile = async (userId: string) => {
    if (!window.confirm("Are you sure you want to reject this alumni profile?")) return;
    try {
      await updateDoc(doc(db, "alumniProfiles", `${schoolId}_${userId}`), {
        approvalStatus: "rejected"
      });
      await updateDoc(doc(db, "memberships", `${schoolId}_${userId}`), {
        status: "rejected"
      });
      alert("Alumni profile status set to rejected.");
      setSelectedReviewAlumni(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `alumniProfiles/${schoolId}_${userId}`);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsName.trim() || savingSettings) return;

    if (settingsName.trim().length > 100) {
      alert("Network Name must be 100 characters or fewer.");
      return;
    }

    setSavingSettings(true);
    try {
      await updateDoc(doc(db, "schools", schoolId), {
        name: settingsName.trim()
      });
      setNetworkName(settingsName.trim());
      alert("School network settings updated successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `schools/${schoolId}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const pendingQueue = alumni.filter(a => a.profile.approvalStatus === "pending");
  const approvedAlumni = alumni.filter(a => a.profile.approvalStatus === "approved");

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader className="w-8 h-8 text-stone-300 animate-spin" />
      </div>
    );
  }

  // RENDER NETWORK SETTINGS SECTION
  if (activeSection === "settings") {
    return (
      <div className="space-y-6 max-w-xl">
        <div>
          <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">Network Settings</h2>
          <p className="text-sm text-stone-500 font-medium">Manage general administrative properties of this isolated school node.</p>
        </div>

        <form onSubmit={handleSaveSettings} className="bg-white border border-stone-200 rounded-none p-6 shadow-none space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
              Network Name
            </label>
            <input
              type="text"
              required
              maxLength={100}
              placeholder="e.g. BIT Alumni Network"
              value={settingsName}
              onChange={(e) => setSettingsName(e.target.value)}
              className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
            />
            <p className="text-[11px] text-stone-400 mt-1 font-sans">This name will be displayed in the header, title, and onboarding screens for all members.</p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingSettings || !settingsName.trim()}
              id="save-network-settings-btn"
              className="bg-[#1C1A17] hover:bg-[#2E2B27] text-white font-mono text-xs uppercase tracking-wider px-4 py-3 rounded-none shadow-none transition-colors disabled:opacity-50 cursor-pointer"
            >
              {savingSettings ? "Updating..." : "Save Settings"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // RENDER MANAGE ALUMNI SECTION
  return (
    <div className="space-y-8">
      {/* Overview Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 rounded-none p-5 shadow-none flex items-center space-x-4">
          <div className="p-3 bg-stone-50 text-stone-900 rounded-none border border-stone-200 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-2xl font-serif font-bold text-stone-900 leading-tight">
              {approvedAlumni.length}
            </span>
            <span className="text-[10px] text-stone-400 font-mono uppercase tracking-wider">
              Approved Alumni
            </span>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-none p-5 shadow-none flex items-center space-x-4">
          <div className="p-3 bg-stone-50 text-stone-900 rounded-none border border-stone-200 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-2xl font-serif font-bold text-stone-900 leading-tight">
              {pendingQueue.length}
            </span>
            <span className="text-[10px] text-stone-400 font-mono uppercase tracking-wider">
              Pending approvals
            </span>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-none p-5 shadow-none flex items-center space-x-4">
          <div className="p-3 bg-stone-50 text-stone-900 rounded-none border border-stone-200 shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-2xl font-serif font-bold text-stone-900 leading-tight">
              {studentsCount}
            </span>
            <span className="text-[10px] text-stone-400 font-mono uppercase tracking-wider">
              Total Students
            </span>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-none p-5 shadow-none flex items-center space-x-4">
          <div className="p-3 bg-stone-50 text-stone-900 rounded-none border border-stone-200 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-2xl font-serif font-bold text-stone-900 leading-tight">
              {mentorshipsCount}
            </span>
            <span className="text-[10px] text-stone-400 font-mono uppercase tracking-wider">
              Active Mentorships
            </span>
          </div>
        </div>
      </div>

      {/* Invite Members Link Widget */}
      <div className="bg-white border border-stone-200 rounded-none p-6 shadow-none space-y-6">
        <div className="space-y-1">
          <h3 className="text-base font-serif font-bold text-[#1C1A17]">Invite Members</h3>
          <p className="text-xs text-stone-500">
            Copy these permanent, reusable invitation links to invite current students and alumni to join your school network.
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">General Invite Link</span>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/join/${schoolId}`}
                className="flex-1 bg-stone-50 border border-stone-200 text-stone-700 font-mono text-xs px-3 py-2 rounded-none focus:outline-none focus:ring-0"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/join/${schoolId}`);
                  alert("General invitation link copied!");
                }}
                className="bg-[#1C1A17] hover:bg-[#2E2B27] text-[#FAF7F2] font-mono text-[10px] uppercase tracking-wider py-2 px-3 rounded-none transition-colors shrink-0 cursor-pointer"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">Student-Only Invite Link</span>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/join/${schoolId}/student`}
                className="flex-1 bg-stone-50 border border-stone-200 text-stone-700 font-mono text-xs px-3 py-2 rounded-none focus:outline-none focus:ring-0"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/join/${schoolId}/student`);
                  alert("Student invitation link copied!");
                }}
                className="bg-[#1C1A17] hover:bg-[#2E2B27] text-[#FAF7F2] font-mono text-[10px] uppercase tracking-wider py-2 px-3 rounded-none transition-colors shrink-0 cursor-pointer"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">Alumnus-Only Invite Link</span>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/join/${schoolId}/alumnus`}
                className="flex-1 bg-stone-50 border border-stone-200 text-stone-700 font-mono text-xs px-3 py-2 rounded-none focus:outline-none focus:ring-0"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/join/${schoolId}/alumnus`);
                  alert("Alumnus invitation link copied!");
                }}
                className="bg-[#1C1A17] hover:bg-[#2E2B27] text-[#FAF7F2] font-mono text-[10px] uppercase tracking-wider py-2 px-3 rounded-none transition-colors shrink-0 cursor-pointer"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Review Queue Collection */}
      <div className="space-y-4">
        <h3 className="text-lg font-serif font-bold text-stone-900 flex items-center space-x-2">
          <span className="w-2 h-2 bg-amber-600 rounded-none"></span>
          <span>Pending Approvals Queue ({pendingQueue.length})</span>
        </h3>

        {pendingQueue.length === 0 ? (
          <div className="bg-white border border-dashed border-stone-300 rounded-none p-8 text-center max-w-2xl">
            <CheckCircle className="w-10 h-10 text-stone-300 mx-auto mb-2" />
            <p className="text-stone-500 text-sm font-medium">All alumni registrations are fully reviewed and approved.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingQueue.map((al) => (
              <div 
                key={al.uid}
                className="bg-white border border-stone-200 rounded-none p-5 shadow-none space-y-4 flex flex-col justify-between hover:border-stone-400 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <img
                      src={al.user.photoURL}
                      alt={al.user.displayName}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-none object-cover border border-stone-200"
                    />
                    <div>
                      <h4 className="font-serif font-bold text-stone-900 text-sm leading-tight">{al.user.displayName}</h4>
                      <p className="text-[10px] text-stone-400 font-mono uppercase tracking-wider">{al.profile.degree} ({al.profile.graduationYear})</p>
                    </div>
                  </div>

                  <p className="text-stone-600 text-xs">
                    Current role: <strong>{al.profile.currentJobTitle}</strong> at <strong>{al.profile.currentCompany}</strong> in {al.profile.country}
                  </p>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-stone-100">
                  <button
                    onClick={() => setSelectedReviewAlumni(al)}
                    className="text-xs font-mono uppercase tracking-wider text-stone-500 hover:text-stone-900 transition-colors inline-flex items-center space-x-1 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Read Full Journey</span>
                  </button>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleRejectProfile(al.uid)}
                      className="p-1 text-stone-400 hover:text-stone-900 hover:bg-stone-50 rounded-none transition-colors cursor-pointer"
                      title="Reject registration"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleApproveProfile(al.uid)}
                      className="bg-[#1C1A17] hover:bg-[#2E2B27] text-white text-xs font-mono uppercase tracking-wider px-3 py-1.5 rounded-none transition-colors flex items-center space-x-1 shadow-none cursor-pointer"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Approve</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full Registered Members Directory (List style) */}
      <div className="space-y-4">
        <h3 className="text-lg font-serif font-bold text-stone-900">Approved Alumni Network Directory ({approvedAlumni.length})</h3>

        {approvedAlumni.length === 0 ? (
          <p className="text-sm text-stone-400 italic font-sans">No approved alumni registered on this network yet.</p>
        ) : (
          <div className="bg-white border border-stone-200 rounded-none overflow-hidden shadow-none divide-y divide-stone-200">
            {approvedAlumni.map((al) => (
              <div 
                key={al.uid}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <img
                    src={al.user.photoURL}
                    alt={al.user.displayName}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-none object-cover border border-stone-200"
                  />
                  <div>
                    <h4 className="font-serif font-bold text-stone-900 text-sm leading-none mb-1">{al.user.displayName}</h4>
                    <p className="text-xs text-stone-500 font-sans">
                      {al.profile.degree} | {al.profile.currentJobTitle} at {al.profile.currentCompany} ({al.profile.country})
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0 self-end sm:self-center">
                  <span className="bg-stone-100 text-stone-800 text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-none border border-stone-200">
                    Approved
                  </span>
                  <button
                    onClick={() => handleRejectProfile(al.uid)}
                    className="text-xs text-stone-400 hover:text-stone-900 font-mono uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Revoke Approval
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full Journey Drawer/Modal for approvals */}
      {selectedReviewAlumni && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-none max-w-2xl w-full border border-stone-200 p-6 space-y-6 shadow-none overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-stone-100 pb-3">
              <div>
                <h4 className="text-lg font-serif font-bold text-stone-900">Alumni Journey Review</h4>
                <p className="text-xs text-stone-400 mt-0.5 font-mono uppercase tracking-wider">Submitted by {selectedReviewAlumni.user.displayName}</p>
              </div>
              <button 
                onClick={() => setSelectedReviewAlumni(null)}
                className="text-stone-400 hover:text-stone-900 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Profile fields */}
            <div className="bg-stone-50 p-4 rounded-none border border-stone-200 grid grid-cols-2 gap-4 text-xs font-sans">
              <div>
                <p className="text-stone-400 uppercase font-mono font-bold tracking-wider mb-1 text-[9px]">Alma Mater / Degree</p>
                <p className="font-serif font-bold text-stone-800">{selectedReviewAlumni.profile.university} / {selectedReviewAlumni.profile.degree}</p>
              </div>
              <div>
                <p className="text-stone-400 uppercase font-mono font-bold tracking-wider mb-1 text-[9px]">Graduation Year / Location</p>
                <p className="font-serif font-bold text-stone-800">{selectedReviewAlumni.profile.graduationYear} in {selectedReviewAlumni.profile.country}</p>
              </div>
              <div className="col-span-2">
                <p className="text-stone-400 uppercase font-mono font-bold tracking-wider mb-1 text-[9px]">Current Job Title & Employer</p>
                <p className="font-serif font-bold text-stone-800">{selectedReviewAlumni.profile.currentJobTitle} at {selectedReviewAlumni.profile.currentCompany}</p>
              </div>
            </div>

            {/* Journey answers */}
            <div className="space-y-4 text-sm leading-relaxed max-h-[350px] overflow-y-auto pr-1">
              <div className="space-y-1">
                <h5 className="font-serif font-bold text-stone-800 text-xs text-stone-500 uppercase tracking-wider">1. Tell us your story</h5>
                <p className="text-stone-700 bg-stone-50/50 p-3 rounded-none border border-stone-200 font-sans whitespace-pre-wrap">{selectedReviewAlumni.profile.journey.story}</p>
              </div>
              <div className="space-y-1">
                <h5 className="font-serif font-bold text-stone-800 text-xs text-stone-500 uppercase tracking-wider">2. What helped you succeed?</h5>
                <p className="text-stone-700 bg-stone-50/50 p-3 rounded-none border border-stone-200 font-sans whitespace-pre-wrap">{selectedReviewAlumni.profile.journey.whatHelpedSucceed}</p>
              </div>
              <div className="space-y-1">
                <h5 className="font-serif font-bold text-stone-800 text-xs text-stone-500 uppercase tracking-wider">3. Biggest challenge</h5>
                <p className="text-stone-700 bg-stone-50/50 p-3 rounded-none border border-stone-200 font-sans whitespace-pre-wrap">{selectedReviewAlumni.profile.journey.biggestChallenge}</p>
              </div>
              <div className="space-y-1">
                <h5 className="font-serif font-bold text-stone-800 text-xs text-stone-500 uppercase tracking-wider">4. If you could start again...</h5>
                <p className="text-stone-700 bg-stone-50/50 p-3 rounded-none border border-stone-200 font-sans whitespace-pre-wrap">{selectedReviewAlumni.profile.journey.startAgain}</p>
              </div>
              <div className="space-y-1">
                <h5 className="font-serif font-bold text-amber-800 text-xs uppercase tracking-wider">5. Advice for current students</h5>
                <p className="text-stone-900 bg-amber-50/50 p-3 rounded-none border border-amber-200 font-medium font-sans whitespace-pre-wrap">"{selectedReviewAlumni.profile.journey.adviceForStudents}"</p>
              </div>
              <div className="space-y-1">
                <h5 className="font-serif font-bold text-stone-800 text-xs text-stone-500 uppercase tracking-wider">6. Resources you recommend</h5>
                <p className="text-stone-700 bg-stone-50/50 p-3 rounded-none border border-stone-200 font-sans whitespace-pre-wrap">{selectedReviewAlumni.profile.journey.recommendedResources}</p>
              </div>
              <div className="space-y-1">
                <h5 className="font-serif font-bold text-stone-800 text-xs text-stone-500 uppercase tracking-wider">7. Fun fact</h5>
                <p className="text-stone-700 bg-stone-50/50 p-3 rounded-none border border-stone-200 font-sans whitespace-pre-wrap">{selectedReviewAlumni.profile.journey.funFact}</p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-stone-200">
              <button
                onClick={() => handleRejectProfile(selectedReviewAlumni.uid)}
                className="px-4 py-2 border border-stone-200 text-stone-600 rounded-none text-xs font-mono uppercase tracking-wider hover:bg-stone-50 cursor-pointer"
              >
                Reject / Deny Approval
              </button>
              <button
                onClick={() => handleApproveProfile(selectedReviewAlumni.uid)}
                className="bg-[#1C1A17] hover:bg-[#2E2B27] text-white font-mono text-xs uppercase tracking-wider px-5 py-2 rounded-none shadow-none cursor-pointer"
              >
                Approve Registration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
