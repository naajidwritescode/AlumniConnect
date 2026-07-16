import React, { useState, useEffect } from "react";
import { 
  Inbox, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MessageSquare, 
  AlertCircle,
  GraduationCap,
  Loader
} from "lucide-react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  doc, 
  getDoc, 
  Timestamp 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { MentorshipRequestDoc, UserDoc, StudentProfileDoc } from "../types";

interface RequestsViewProps {
  currentUserId: string;
  currentUserRole: "student" | "alumnus" | "admin";
  setCurrentTab: (tab: string) => void;
  setSelectedConversationId: (id: string | null) => void;
  schoolId: string;
}

interface ResolvedRequest {
  request: MentorshipRequestDoc;
  studentUser?: UserDoc;
  studentProfile?: StudentProfileDoc;
  alumnusUser?: UserDoc;
}

export default function RequestsView({ 
  currentUserId, 
  currentUserRole,
  setCurrentTab,
  setSelectedConversationId,
  schoolId
}: RequestsViewProps) {
  const [requests, setRequests] = useState<ResolvedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "accepted" | "declined">("pending");

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);

    // Determine query based on role
    const colRef = collection(db, "mentorshipRequests");
    const q = currentUserRole === "student"
      ? query(colRef, where("schoolId", "==", schoolId), where("studentId", "==", currentUserId))
      : query(colRef, where("schoolId", "==", schoolId), where("alumnusId", "==", currentUserId));

    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        try {
          const list: ResolvedRequest[] = [];
          
          for (const docSnap of snapshot.docs) {
            const reqData = docSnap.data() as MentorshipRequestDoc;
            reqData.requestId = docSnap.id;

            const resolved: ResolvedRequest = { request: reqData };

            // Resolve student info (for alumnus inbox) or alumnus info (for student sent box)
            if (currentUserRole === "alumnus") {
              const uSnap = await getDoc(doc(db, "users", reqData.studentId));
              if (uSnap.exists()) {
                resolved.studentUser = uSnap.data() as UserDoc;
              }
              const pSnap = await getDoc(doc(db, "studentProfiles", `${schoolId}_${reqData.studentId}`));
              if (pSnap.exists()) {
                resolved.studentProfile = pSnap.data() as StudentProfileDoc;
              }
            } else {
              const uSnap = await getDoc(doc(db, "users", reqData.alumnusId));
              if (uSnap.exists()) {
                resolved.alumnusUser = uSnap.data() as UserDoc;
              }
            }

            list.push(resolved);
          }

          // Sort by creation date newest first
          list.sort((a, b) => {
            const aTime = a.request.createdAt?.toDate().getTime() || 0;
            const bTime = b.request.createdAt?.toDate().getTime() || 0;
            return bTime - aTime;
          });

          setRequests(list);
          setLoading(false);
        } catch (error) {
          console.error("Error loading requests:", error);
          setLoading(false);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "mentorshipRequests");
      }
    );

    return () => unsub();
  }, [currentUserId, currentUserRole, schoolId]);

  const handleAcceptRequest = async (req: MentorshipRequestDoc) => {
    if (!req.requestId || !schoolId) return;
    try {
      // 1. Update mentorshipRequest status
      await updateDoc(doc(db, "mentorshipRequests", req.requestId), {
        status: "accepted",
        respondedAt: Timestamp.now()
      });

      // 2. Create the conversation document
      const convPayload = {
        schoolId,
        participantIds: [req.studentId, req.alumnusId],
        lastMessageAt: Timestamp.now()
      };
      await setDoc(doc(db, "conversations", req.requestId), convPayload);

      // 3. Optional: Add initial automated greeting message inside conversation
      await setDoc(doc(db, `conversations/${req.requestId}/messages/init_greet`), {
        senderId: req.alumnusId,
        text: `Hello! I have accepted your mentorship request. Let's chat here.`,
        sentAt: Timestamp.now()
      });

      alert("Request accepted! A 1:1 conversation has been initiated.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `mentorshipRequests/${req.requestId}`);
    }
  };

  const handleDeclineRequest = async (req: MentorshipRequestDoc) => {
    if (!req.requestId) return;
    if (!window.confirm("Are you sure you want to decline this mentorship request?")) return;
    try {
      await updateDoc(doc(db, "mentorshipRequests", req.requestId), {
        status: "declined",
        respondedAt: Timestamp.now()
      });
      alert("Request declined.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `mentorshipRequests/${req.requestId}`);
    }
  };

  const handleOpenChat = (requestId: string) => {
    setSelectedConversationId(requestId);
    setCurrentTab("messages");
  };

  // Filter requests according to the active tab
  const filteredRequests = requests.filter(r => r.request.status === activeTab);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">
          {currentUserRole === "student" ? "My Requests" : "Mentorship Requests"}
        </h2>
        <p className="text-sm text-stone-500">
          {currentUserRole === "student" 
            ? "Track the status of your active and past connection requests." 
            : "Review pending mentorship inquiries, view journeys, and start messaging mentees."}
        </p>
      </div>

      {/* Alumnus Tabs or Student Tab indicators */}
      {currentUserRole === "alumnus" ? (
        <div className="border-b border-stone-200">
          <div className="flex space-x-6">
            {(["pending", "accepted", "declined"] as const).map((tab) => {
              const isActive = activeTab === tab;
              const count = requests.filter(r => r.request.status === tab).length;
              
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    py-4 px-2 font-mono text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors relative capitalize cursor-pointer
                    ${isActive 
                      ? "border-amber-600 text-stone-900" 
                      : "border-transparent text-stone-400 hover:text-stone-600"
                    }
                  `}
                >
                  <span>{tab} Requests</span>
                  {count > 0 && (
                    <span className={`
                      ml-2 text-[9px] px-2 py-0.5 rounded-none font-bold font-mono
                      ${isActive ? "bg-amber-600 text-white" : "bg-stone-100 text-stone-500"}
                    `}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="border-b border-stone-200">
          <div className="flex space-x-6">
            {(["pending", "accepted", "declined"] as const).map((tab) => {
              const isActive = activeTab === tab;
              const count = requests.filter(r => r.request.status === tab).length;

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    py-4 px-2 font-mono text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors capitalize cursor-pointer
                    ${isActive 
                      ? "border-amber-600 text-stone-900" 
                      : "border-transparent text-stone-400 hover:text-stone-600"
                    }
                  `}
                >
                  <span>{tab} ({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-10">
          <Loader className="w-8 h-8 text-stone-300 animate-spin" />
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-none p-12 text-center max-w-2xl mx-auto">
          <Inbox className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-800 font-serif font-bold text-base">
            {currentUserRole === "student"
              ? `You have no ${activeTab} requests.`
              : `No ${activeTab} mentorship requests.`}
          </p>
          {currentUserRole === "student" && activeTab === "pending" && (
            <p className="text-stone-500 text-sm mt-1.5 font-sans">
              You haven't reached out to anyone yet. Browse the directory to find someone who's walked your path.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4 max-w-4xl">
          {filteredRequests.map((item) => {
            const req = item.request;
            const stuUser = item.studentUser;
            const stuProfile = item.studentProfile;
            const alUser = item.alumnusUser;

            return (
              <div
                key={req.requestId}
                className="bg-white border border-stone-200 rounded-none p-6 shadow-none space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {currentUserRole === "alumnus" ? (
                    /* ALUMNUS PERSPECTIVE */
                    <div className="flex items-start space-x-3.5">
                      <img
                        src={stuUser?.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80"}
                        alt={stuUser?.displayName}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-none object-cover border border-stone-200 shrink-0"
                      />
                      <div className="space-y-1">
                        <h4 className="font-serif font-bold text-stone-900 leading-tight text-base">
                          {stuUser?.displayName}
                        </h4>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-mono text-stone-500 uppercase tracking-wider">
                          {(stuProfile?.currentClass || (stuProfile as any)?.currentStage) && (
                            <span className="flex items-center space-x-1">
                              <GraduationCap className="w-3.5 h-3.5" />
                              <span>Class: {stuProfile?.currentClass || (stuProfile as any)?.currentStage}</span>
                            </span>
                          )}
                          {(stuProfile?.intendedFieldOfStudy || (stuProfile as any)?.interestArea) && (
                            <span>&bull; Field: {stuProfile?.intendedFieldOfStudy || (stuProfile as any)?.interestArea}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* STUDENT PERSPECTIVE */
                    <div className="flex items-start space-x-3.5">
                      <img
                        src={alUser?.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80"}
                        alt={alUser?.displayName}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-none object-cover border border-stone-200 shrink-0"
                      />
                      <div className="space-y-1">
                        <h4 className="font-serif font-bold text-stone-900 leading-tight text-base">
                          Mentorship with {alUser?.displayName}
                        </h4>
                        <p className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">
                          Sent on {req.createdAt?.toDate().toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Status Indicator pill */}
                  <div className="flex items-center space-x-2">
                    {req.status === "pending" && (
                      <span className="bg-amber-50/50 text-amber-900 border border-amber-200 text-[10px] font-mono font-bold px-3 py-1 rounded-none inline-flex items-center space-x-1.5 shadow-none uppercase tracking-wider">
                        <Clock className="w-3.5 h-3.5 animate-pulse" />
                        <span>Pending Review</span>
                      </span>
                    )}
                    {req.status === "accepted" && (
                      <span className="bg-emerald-50/50 text-emerald-950 border border-emerald-200 text-[10px] font-mono font-bold px-3 py-1 rounded-none inline-flex items-center space-x-1.5 shadow-none uppercase tracking-wider">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Connected</span>
                      </span>
                    )}
                    {req.status === "declined" && (
                      <span className="bg-stone-50 text-stone-600 border border-stone-200 text-[10px] font-mono font-medium px-3 py-1 rounded-none inline-flex items-center space-x-1.5 uppercase tracking-wider">
                        <XCircle className="w-3.5 h-3.5 text-stone-400" />
                        <span>Unavailable</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-stone-50 border border-stone-200 rounded-none p-4 text-sm text-stone-700 leading-relaxed italic font-sans">
                  &ldquo;{req.message}&rdquo;
                </div>

                {/* Actions row */}
                <div className="flex justify-end pt-2 border-t border-stone-100 gap-2">
                  {currentUserRole === "alumnus" && req.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleDeclineRequest(req)}
                        className="px-4 py-2 border border-stone-200 text-stone-500 hover:text-stone-700 hover:bg-stone-50 rounded-none text-xs font-mono font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleAcceptRequest(req)}
                        className="bg-[#1C1A17] hover:bg-[#2E2B27] text-white font-mono font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-none shadow-none cursor-pointer"
                      >
                        Accept &amp; Open Chat
                      </button>
                    </>
                  )}

                  {req.status === "accepted" && (
                    <button
                      onClick={() => handleOpenChat(req.requestId!)}
                      className="bg-[#1C1A17] hover:bg-[#2E2B27] text-white font-mono font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-none shadow-none inline-flex items-center space-x-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4 text-amber-400" />
                      <span>Open Chat Room</span>
                    </button>
                  )}

                  {currentUserRole === "student" && req.status === "declined" && (
                    <p className="text-[10px] font-mono uppercase tracking-wider text-stone-400 italic">
                      This alumnus is currently at capacity or unable to mentor right now.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
