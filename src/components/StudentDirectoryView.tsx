import React, { useState, useEffect } from "react";
import { 
  Search, 
  MapPin, 
  GraduationCap, 
  User, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader,
  Users,
  Mail,
  BookOpen
} from "lucide-react";
import { 
  collection, 
  query, 
  where, 
  doc, 
  getDoc, 
  updateDoc, 
  onSnapshot 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserDoc, StudentProfileDoc } from "../types";

interface StudentDirectoryViewProps {
  currentUserId: string;
  currentUserRole: "student" | "alumnus" | "admin";
  schoolId: string;
}

interface StudentWithUser {
  uid: string;
  user: UserDoc;
  profile: StudentProfileDoc | null;
  membershipStatus: string;
}

export default function StudentDirectoryView({ currentUserId, currentUserRole, schoolId }: StudentDirectoryViewProps) {
  const [students, setStudents] = useState<StudentWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");

  const classes = ["Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"];

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);

    // Listen to all active student memberships for this school
    const studentsQuery = query(
      collection(db, "memberships"), 
      where("schoolId", "==", schoolId),
      where("role", "==", "student"),
      where("status", "==", "active")
    );

    const unsubStudents = onSnapshot(
      studentsQuery,
      async (snapshot) => {
        try {
          const membersList: { userId: string; status: string }[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            membersList.push({
              userId: data.userId,
              status: data.status
            });
          });

          // Fetch user and student profile documents for each resolved member
          const resolvedPromises = membersList.map(async (member) => {
            try {
              // 1. Fetch user doc
              const uSnap = await getDoc(doc(db, "users", member.userId));
              if (!uSnap.exists()) return null;
              const userDoc = uSnap.data() as UserDoc;

              // 2. Fetch student profile doc
              const pSnap = await getDoc(doc(db, "studentProfiles", `${schoolId}_${member.userId}`));
              const studentProfile = pSnap.exists() ? pSnap.data() as StudentProfileDoc : null;

              return {
                uid: member.userId,
                user: userDoc,
                profile: studentProfile,
                membershipStatus: member.status
              };
            } catch (err) {
              console.error("Error loading details for student member:", member.userId, err);
              return null;
            }
          });

          const resolved = (await Promise.all(resolvedPromises)).filter(
            (item): item is StudentWithUser => item !== null
          );

          setStudents(resolved);
          setLoading(false);
        } catch (error) {
          console.error("Error building student directory:", error);
          setLoading(false);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "memberships");
      }
    );

    return () => unsubStudents();
  }, [schoolId]);

  const handleRevokeStudent = async (studentId: string) => {
    const confirmation = window.confirm(
      "Are you absolutely sure you want to revoke this student's access to the school network?\n\nThey will immediately lose access to all portals, resources, and directory views for this school."
    );
    if (!confirmation) return;

    setRevokingId(studentId);
    try {
      // Set membership status to 'revoked'
      await updateDoc(doc(db, "memberships", `${schoolId}_${studentId}`), {
        status: "revoked"
      });
      alert("Student access has been successfully revoked.");
    } catch (error) {
      console.error("Error revoking student membership:", error);
      alert("Failed to revoke student. Please try again.");
    } finally {
      setRevokingId(null);
    }
  };

  // Filter students
  const filteredStudents = students.filter((st) => {
    // 1. Search filter (Name, Intended field, class)
    const nameMatch = st.user.displayName.toLowerCase().includes(searchQuery.toLowerCase());
    const fieldMatch = st.profile?.intendedFieldOfStudy?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    const classMatch = st.profile?.currentClass?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    const matchesSearch = searchQuery === "" || nameMatch || fieldMatch || classMatch;

    // 2. Class filter
    const matchesClass = !classFilter || st.profile?.currentClass === classFilter;

    return matchesSearch && matchesClass;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader className="w-8 h-8 text-stone-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div>
        <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">Student Directory</h2>
        <p className="text-sm text-stone-500 font-medium">Browse active students within this network, view their fields of study, and build peer relationships.</p>
      </div>

      {/* Filter and search bar */}
      <div className="bg-white border border-stone-200 p-4 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search students by name, interest, class..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none pl-9 pr-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
          />
        </div>

        <div className="w-full md:w-56">
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-mono text-xs uppercase"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Directory Count */}
      <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-stone-500 font-bold px-1">
        <span>Showing {filteredStudents.length} of {students.length} Students</span>
      </div>

      {/* Student List */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white border border-dashed border-stone-300 p-12 text-center">
          <Users className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <p className="text-stone-500 text-sm font-medium">No students matched your search criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredStudents.map((st) => (
            <div 
              key={st.uid}
              className="bg-white border border-stone-200 rounded-none p-5 shadow-none flex flex-col justify-between hover:border-stone-400 transition-colors"
            >
              <div className="space-y-4">
                {/* Profile Header */}
                <div className="flex items-start space-x-4">
                  <img
                    src={st.user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(st.user.displayName)}`}
                    alt={st.user.displayName}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-none object-cover border border-stone-200 bg-stone-50 shrink-0"
                  />
                  <div className="space-y-1 min-w-0 flex-1">
                    <h3 className="font-serif font-bold text-stone-900 text-base leading-tight truncate">
                      {st.user.displayName}
                    </h3>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] font-mono uppercase tracking-wider text-stone-400">
                      <span className="flex items-center space-x-1">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{st.profile?.currentClass || "Profile Not Set"}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Profile Body */}
                <div className="space-y-2 text-xs">
                  {st.profile ? (
                    <>
                      {st.profile.intendedFieldOfStudy && (
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider block">Intended Field of Study</span>
                          <p className="text-stone-800 font-medium font-sans">{st.profile.intendedFieldOfStudy}</p>
                        </div>
                      )}

                      {st.profile.shortIntroduction ? (
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider block">Introduction</span>
                          <p className="text-stone-600 font-sans italic">"{st.profile.shortIntroduction}"</p>
                        </div>
                      ) : (
                        <p className="text-stone-400 italic">No introduction added yet.</p>
                      )}
                    </>
                  ) : (
                    <div className="bg-stone-50 border border-stone-200/60 p-3 text-stone-500 italic text-center rounded-none font-sans">
                      This student has not completed setting up their profile fields yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Action and/or Admin panel row */}
              <div className="flex justify-between items-center pt-4 mt-4 border-t border-stone-100 text-xs">
                {currentUserRole === "admin" ? (
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider flex items-center space-x-1">
                      <Mail className="w-3 h-3" />
                      <span>{st.user.email}</span>
                    </span>
                    <button
                      onClick={() => handleRevokeStudent(st.uid)}
                      disabled={revokingId === st.uid}
                      className="text-red-700 hover:text-red-900 font-mono font-bold uppercase tracking-wider text-[10px] transition-colors cursor-pointer"
                    >
                      {revokingId === st.uid ? "Revoking..." : "Revoke Student"}
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider flex items-center space-x-1">
                    <Mail className="w-3 h-3" />
                    <span>{st.user.email}</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
