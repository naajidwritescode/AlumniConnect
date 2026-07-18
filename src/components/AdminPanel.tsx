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
  getDocs,
  deleteDoc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserDoc, AlumniProfileDoc } from "../types";

interface AdminPanelProps {
  currentUserId: string;
  networkName: string;
  setNetworkName: (name: string) => void;
  activeSection: "manage-alumni" | "settings";
  schoolId: string;
  schoolCode: string;
}

interface AdminAlumniWithUser {
  uid: string;
  docId: string;
  user: UserDoc;
  profile: AlumniProfileDoc;
}

export default function AdminPanel({ 
  currentUserId, 
  networkName, 
  setNetworkName,
  activeSection,
  schoolId,
  schoolCode
}: AdminPanelProps) {
  const [alumni, setAlumni] = useState<AdminAlumniWithUser[]>([]);
  const [pendingStudents, setPendingStudents] = useState<any[]>([]);
  const [studentsCount, setStudentsCount] = useState(0);
  const [mentorshipsCount, setMentorshipsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Settings form
  const [settingsName, setSettingsName] = useState(networkName);
  const [settingsCountry, setSettingsCountry] = useState("");
  const [settingsCity, setSettingsCity] = useState("");
  const [settingsLogoUrl, setSettingsLogoUrl] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [resettingSchool, setResettingSchool] = useState(false);

  // Selected alumnus journey drawer/modal
  const [selectedReviewAlumni, setSelectedReviewAlumni] = useState<AdminAlumniWithUser | null>(null);

  useEffect(() => {
    if (!schoolId) return;

    // Load detailed school settings
    getDoc(doc(db, "schools", schoolId)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setSettingsName(data.name || "");
        setSettingsCountry(data.country || "");
        setSettingsCity(data.city || "");
        setSettingsLogoUrl(data.logoUrl || "");
      }
    }).catch(err => {
      console.error("Error loading school details:", err);
    });

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
                docId: item.docId,
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

    // 4. Listen to pending student memberships
    const unsubPendingStudents = onSnapshot(
      query(
        collection(db, "memberships"),
        where("schoolId", "==", schoolId),
        where("role", "==", "student"),
        where("status", "==", "pending")
      ),
      async (snapshot) => {
        try {
          const list: any[] = [];
          for (const docSnap of snapshot.docs) {
            const mData = docSnap.data();
            const uSnap = await getDoc(doc(db, "users", mData.userId));
            const pSnap = await getDoc(doc(db, "studentProfiles", `${schoolId}_${mData.userId}`));
            if (uSnap.exists()) {
              list.push({
                userId: mData.userId,
                membershipId: docSnap.id,
                user: uSnap.data(),
                profile: pSnap.exists() ? pSnap.data() : null
              });
            }
          }
          setPendingStudents(list);
        } catch (err) {
          console.error("Error loading pending students:", err);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "memberships");
      }
    );

    return () => {
      unsubAlumni();
      unsubStudents();
      unsubMentorships();
      unsubPendingStudents();
    };
  }, [schoolId]);

  const handleApproveProfile = async (userId: string, docId: string) => {
    try {
      await updateDoc(doc(db, "alumniProfiles", docId), {
        approvalStatus: "approved"
      });
      await updateDoc(doc(db, "memberships", `${schoolId}_${userId}`), {
        status: "active"
      });
      alert("Alumni profile approved successfully!");
      setSelectedReviewAlumni(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `alumniProfiles/${docId}`);
    }
  };

  const handleRejectProfile = async (userId: string, docId: string) => {
    if (!window.confirm("Are you sure you want to reject this alumni profile?")) return;
    try {
      await updateDoc(doc(db, "alumniProfiles", docId), {
        approvalStatus: "rejected"
      });
      await updateDoc(doc(db, "memberships", `${schoolId}_${userId}`), {
        status: "revoked"
      });
      alert("Alumni profile status set to rejected & access revoked.");
      setSelectedReviewAlumni(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `alumniProfiles/${docId}`);
    }
  };

  const handleApproveStudent = async (userId: string) => {
    try {
      await updateDoc(doc(db, "memberships", `${schoolId}_${userId}`), {
        status: "active"
      });
      alert("Student registration approved successfully!");
    } catch (error) {
      console.error("Error approving student:", error);
      alert("Failed to approve student. Please try again.");
    }
  };

  const handleRejectStudent = async (userId: string) => {
    if (!window.confirm("Are you sure you want to reject this student registration?")) return;
    try {
      await updateDoc(doc(db, "memberships", `${schoolId}_${userId}`), {
        status: "rejected"
      });
      alert("Student registration status set to rejected.");
    } catch (error) {
      console.error("Error rejecting student:", error);
      alert("Failed to reject student. Please try again.");
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
        name: settingsName.trim(),
        country: settingsCountry.trim(),
        city: settingsCity.trim(),
        logoUrl: settingsLogoUrl.trim()
      });
      setNetworkName(settingsName.trim());
      alert("School network settings updated successfully!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `schools/${schoolId}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetSchoolData = async () => {
    const confirmation = window.confirm(
      "CRITICAL WARNING:\n\nAre you absolutely sure you want to reset this school network's data?\n\nThis will permanently delete all student and alumni profiles, announcements, mentorship requests, conversations, opportunities, and all other memberships of this school.\n\nYour own administrator membership will be preserved. This action is irreversible!"
    );
    if (!confirmation) return;

    const finalConfirm = window.prompt(
      "To confirm this action, please type the word 'RESET' below:"
    );
    if (finalConfirm !== "RESET") {
      alert("Reset cancelled. Word did not match.");
      return;
    }

    setResettingSchool(true);
    try {
      // 1. Delete alumniProfiles
      const alumniSnap = await getDocs(query(collection(db, "alumniProfiles"), where("schoolId", "==", schoolId)));
      for (const d of alumniSnap.docs) {
        await deleteDoc(doc(db, "alumniProfiles", d.id));
      }

      // 2. Delete studentProfiles
      const studentSnap = await getDocs(query(collection(db, "studentProfiles"), where("schoolId", "==", schoolId)));
      for (const d of studentSnap.docs) {
        await deleteDoc(doc(db, "studentProfiles", d.id));
      }

      // 3. Delete mentorshipRequests
      const reqSnap = await getDocs(query(collection(db, "mentorshipRequests"), where("schoolId", "==", schoolId)));
      for (const d of reqSnap.docs) {
        await deleteDoc(doc(db, "mentorshipRequests", d.id));
      }

      // 4. Delete conversations (and their subcollection messages)
      const convSnap = await getDocs(query(collection(db, "conversations"), where("schoolId", "==", schoolId)));
      for (const d of convSnap.docs) {
        const msgsSnap = await getDocs(collection(db, "conversations", d.id, "messages"));
        for (const m of msgsSnap.docs) {
          await deleteDoc(doc(db, "conversations", d.id, "messages", m.id));
        }
        await deleteDoc(doc(db, "conversations", d.id));
      }

      // 5. Delete opportunities
      const oppSnap = await getDocs(query(collection(db, "opportunities"), where("schoolId", "==", schoolId)));
      for (const d of oppSnap.docs) {
        await deleteDoc(doc(db, "opportunities", d.id));
      }

      // 6. Delete announcements
      const annSnap = await getDocs(query(collection(db, "announcements"), where("schoolId", "==", schoolId)));
      for (const d of annSnap.docs) {
        await deleteDoc(doc(db, "announcements", d.id));
      }

      // 7. Delete other memberships (preserving the current admin)
      const memSnap = await getDocs(query(collection(db, "memberships"), where("schoolId", "==", schoolId)));
      for (const d of memSnap.docs) {
        const mData = d.data();
        if (mData.userId !== currentUserId) {
          await deleteDoc(doc(db, "memberships", d.id));
        }
      }

      alert("School network data has been successfully reset. All guest profiles and contents are cleared.");
      window.location.reload();
    } catch (error) {
      console.error("Error resetting school network data:", error);
      alert("Failed to reset school network data. See console for error details.");
    } finally {
      setResettingSchool(false);
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                Country
              </label>
              <input
                type="text"
                placeholder="e.g. United States"
                value={settingsCountry}
                onChange={(e) => setSettingsCountry(e.target.value)}
                className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                City / Region
              </label>
              <input
                type="text"
                placeholder="e.g. New York"
                value={settingsCity}
                onChange={(e) => setSettingsCity(e.target.value)}
                className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
              School Logo Image URL (Optional)
            </label>
            <input
              type="url"
              placeholder="e.g. https://example.com/logo.png"
              value={settingsLogoUrl}
              onChange={(e) => setSettingsLogoUrl(e.target.value)}
              className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
            />
            <p className="text-[11px] text-stone-400 mt-1 font-sans">Provide an image URL to show the school logo in the header and onboarding.</p>
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

        {/* Danger Zone */}
        <div className="bg-red-50/50 border border-red-200 rounded-none p-6 space-y-4">
          <div className="flex items-start space-x-3 text-red-900">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-red-700" />
            <div className="text-xs space-y-1">
              <p className="font-serif font-bold text-red-950 text-sm">Danger Zone: Reset School Network Data</p>
              <p className="leading-relaxed text-stone-700">
                This action will delete all alumni profiles, student profiles, mentorship requests, conversations, opportunities, announcements, and guest memberships associated with this school.
              </p>
              <p className="leading-relaxed text-red-800 font-bold">
                Your own admin account and membership will be preserved. This cannot be undone.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleResetSchoolData}
              disabled={resettingSchool}
              className="bg-red-700 hover:bg-red-800 text-white font-mono text-xs uppercase tracking-wider px-4 py-3 rounded-none shadow-none transition-colors disabled:opacity-50 cursor-pointer inline-flex items-center space-x-2"
            >
              {resettingSchool ? (
                <>
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                  <span>Resetting...</span>
                </>
              ) : (
                <span>Reset School Data</span>
              )}
            </button>
          </div>
        </div>
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
              {pendingQueue.length + pendingStudents.length}
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

      {/* School Access Code and QR Code Widget */}
      <div className="bg-white border border-stone-200 rounded-none p-6 shadow-none space-y-6">
        <div className="space-y-1">
          <h3 className="text-base font-serif font-bold text-[#1C1A17]">School Access Code</h3>
          <p className="text-xs text-stone-500">
            Share this permanent, unique School Code or the QR Code with your students and alumni to let them join this school network.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center border-t border-stone-100 pt-6">
          {/* Code and Steps */}
          <div className="md:col-span-7 space-y-5">
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider block">Permanent School Code</span>
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-stone-50 border border-stone-200 px-4 py-3 font-mono text-xl font-bold text-stone-900 select-all tracking-wider">
                  {schoolCode}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(schoolCode);
                    alert("School code copied to clipboard!");
                  }}
                  className="bg-[#1C1A17] hover:bg-[#2E2B27] text-[#FAF7F2] font-mono text-xs uppercase tracking-wider py-4 px-5 rounded-none transition-colors shrink-0 cursor-pointer"
                >
                  Copy Code
                </button>
              </div>
            </div>

            <div className="p-4 bg-stone-50 border border-stone-200 text-xs text-stone-600 leading-relaxed space-y-2">
              <span className="font-bold text-stone-900 block uppercase font-mono text-[9px] tracking-wider">How users join:</span>
              <ol className="list-decimal list-inside space-y-1.5 font-sans">
                <li>Sign in or register for an AlumniConnect account.</li>
                <li>Click <strong className="text-stone-900">Join Existing School</strong>.</li>
                <li>Enter this School Code <strong className="text-stone-900 font-mono text-xs">{schoolCode}</strong> and select their registration role.</li>
              </ol>
            </div>
          </div>

          {/* QR Code */}
          <div className="md:col-span-5 flex flex-col items-center justify-center p-5 bg-stone-50 border border-stone-200 rounded-none space-y-3">
            <span className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider block">Join Portal QR Code</span>
            <div className="bg-white p-3 border border-stone-200 shadow-sm shrink-0">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(schoolCode)}`}
                alt="School Code QR"
                className="w-36 h-36"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-[9px] text-stone-500 font-mono uppercase tracking-wider text-center">Scan to copy School Code</p>
          </div>
        </div>
      </div>

      {/* Review Queue Collection */}
      <div className="space-y-4">
        <h3 className="text-lg font-serif font-bold text-stone-900 flex items-center space-x-2">
          <span className="w-2 h-2 bg-amber-600 rounded-none"></span>
          <span>Pending Alumni Approvals ({pendingQueue.length})</span>
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
                      onClick={() => handleRejectProfile(al.uid, al.docId)}
                      className="p-1 text-stone-400 hover:text-stone-900 hover:bg-stone-50 rounded-none transition-colors cursor-pointer"
                      title="Reject registration"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleApproveProfile(al.uid, al.docId)}
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

      {/* Pending Student Registrations Queue */}
      <div className="space-y-4 pt-6 border-t border-stone-200">
        <h3 className="text-lg font-serif font-bold text-stone-900 flex items-center space-x-2">
          <span className="w-2 h-2 bg-amber-600 rounded-none"></span>
          <span>Pending Student Approvals ({pendingStudents.length})</span>
        </h3>

        {pendingStudents.length === 0 ? (
          <div className="bg-white border border-dashed border-stone-300 rounded-none p-8 text-center max-w-2xl">
            <CheckCircle className="w-10 h-10 text-stone-300 mx-auto mb-2" />
            <p className="text-stone-500 text-sm font-medium">All student registrations are fully reviewed and approved.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingStudents.map((st) => (
              <div 
                key={st.userId}
                className="bg-white border border-stone-200 rounded-none p-5 shadow-none space-y-4 flex flex-col justify-between hover:border-stone-400 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <img
                      src={st.user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(st.user.displayName)}`}
                      alt={st.user.displayName}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-none object-cover border border-stone-200 bg-stone-50"
                    />
                    <div>
                      <h4 className="font-serif font-bold text-stone-900 text-sm leading-tight">{st.user.displayName}</h4>
                      <p className="text-[10px] text-stone-400 font-mono uppercase tracking-wider">
                        {st.profile?.currentClass || "Profile Not Set Yet"}
                      </p>
                    </div>
                  </div>

                  {st.profile ? (
                    <div className="space-y-1 text-xs">
                      {st.profile.intendedFieldOfStudy && (
                        <p className="text-stone-600">
                          Intended Field: <strong>{st.profile.intendedFieldOfStudy}</strong>
                        </p>
                      )}
                      {st.profile.shortIntroduction && (
                        <p className="text-stone-500 italic font-sans">
                          "{st.profile.shortIntroduction}"
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400 italic">No onboarding profile completed yet.</p>
                  )}
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t border-stone-100">
                  <button
                    onClick={() => handleRejectStudent(st.userId)}
                    className="border border-stone-200 hover:bg-stone-50 text-stone-700 font-mono text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-none transition-colors cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApproveStudent(st.userId)}
                    className="bg-[#1C1A17] hover:bg-[#2E2B27] text-white font-mono text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-none transition-colors cursor-pointer"
                  >
                    Approve
                  </button>
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
                    onClick={() => handleRejectProfile(al.uid, al.docId)}
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
                onClick={() => handleRejectProfile(selectedReviewAlumni.uid, selectedReviewAlumni.docId)}
                className="px-4 py-2 border border-stone-200 text-stone-600 rounded-none text-xs font-mono uppercase tracking-wider hover:bg-stone-50 cursor-pointer"
              >
                Reject / Deny Approval
              </button>
              <button
                onClick={() => handleApproveProfile(selectedReviewAlumni.uid, selectedReviewAlumni.docId)}
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
