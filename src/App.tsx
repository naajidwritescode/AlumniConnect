import React, { useState, useEffect } from "react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  updateDoc,
  deleteDoc,
  Timestamp, 
  onSnapshot, 
  collection, 
  query, 
  where,
  limit,
  runTransaction
} from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";
import { UserRole, UserDoc, SchoolDoc, MembershipDoc } from "./types";
import { Analytics } from "@vercel/analytics/react";

// Components
import Sidebar from "./components/Sidebar";
import DirectoryView from "./components/DirectoryView";
import StudentDirectoryView from "./components/StudentDirectoryView";
import OpportunityView from "./components/OpportunityView";
import AnnouncementView from "./components/AnnouncementView";
import RequestsView from "./components/RequestsView";
import MessagesView from "./components/MessagesView";
import ProfileForm from "./components/ProfileForm";
import AdminPanel from "./components/AdminPanel";

// Lucide Icons
import { 
  Sparkles, 
  BookOpen, 
  Briefcase, 
  Megaphone, 
  Users, 
  ShieldCheck, 
  ShieldAlert,
  Loader,
  Inbox,
  ArrowRight,
  Building2,
  Lock,
  Mail,
  UserCheck,
  CheckCircle,
  HelpCircle,
  FolderSync,
  Eye,
  EyeOff
} from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  
  // Multi-Network States
  const [isFirstSetup, setIsFirstSetup] = useState<boolean>(false);
  const [checkingFirstSetup, setCheckingFirstSetup] = useState<boolean>(true);
  
  // Joining School States (via School Code)
  const [joiningSchoolId, setJoiningSchoolId] = useState<string | null>(null);
  const [joiningSchoolRole, setJoiningSchoolRole] = useState<"student" | "alumnus" | null>(null);
  const [joiningSchoolDoc, setJoiningSchoolDoc] = useState<SchoolDoc | null>(null);
  const [checkingJoiningSchool, setCheckingJoiningSchool] = useState<boolean>(false);

  // Active School States
  const [mySchools, setMySchools] = useState<SchoolDoc[]>([]);
  const [myMemberships, setMyMemberships] = useState<MembershipDoc[]>([]);
  const [loadingMemberships, setLoadingMemberships] = useState<boolean>(false);
  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
  const [currentSchool, setCurrentSchool] = useState<SchoolDoc | null>(null);
  
  const [landingChoice, setLandingChoice] = useState<"create" | "join" | null>(null);
  
  // User Scope States within selected School
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isOnboarding, setIsOnboarding] = useState<boolean>(false);
  const [alumniStatus, setAlumniStatus] = useState<"pending" | "approved" | "rejected" | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<"pending" | "active" | "revoked" | "rejected" | null>(null);
  const [revocationStatus, setRevocationStatus] = useState<"revoked" | "rejected" | null>(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);

  // Navigation
  const [currentTab, setCurrentTab] = useState<string>(() => {
    const path = window.location.pathname;
    if (path === "/profile") return "profile";
    if (path === "/messages") return "messages";
    if (path === "/opportunities") return "opportunities";
    if (path === "/announcements") return "announcements";
    if (path === "/directory") return "directory";
    if (path === "/student-directory") return "student-directory";
    if (path === "/requests") return "requests";
    return "dashboard";
  });
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [initialRedirectPath, setInitialRedirectPath] = useState<string | null>(() => {
    const path = window.location.pathname;
    if (path !== "/" && path !== "/login" && !path.startsWith("/join/")) {
      return path;
    }
    return null;
  });

  // Sign In inputs
  const [emailInput, setEmailInput] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  // Redesigned Auth states
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [googleSigningIn, setGoogleSigningIn] = useState(false);

  // Inline validation error states
  const [emailError, setEmailError] = useState("");
  const [fullNameError, setFullNameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");

  // Forgot password modal state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState("");
  
  // School Code inputs
  const [enteredSchoolCode, setEnteredSchoolCode] = useState("");
  const [schoolCodeError, setSchoolCodeError] = useState("");

  // Setup form
  const [setupSchoolName, setSetupSchoolName] = useState("");
  const [setupSchoolDesc, setSetupSchoolDesc] = useState("");
  const [setupCountry, setSetupCountry] = useState("");
  const [setupCity, setSetupCity] = useState("");
  const [setupLogoUrl, setSetupLogoUrl] = useState("");
  const [savingSetup, setSavingSetup] = useState(false);
  const [resolvingCode, setResolvingCode] = useState(false);

  // 1. On Mount: Check if schools exist to determine First-Time Setup
  useEffect(() => {
    const runResetAndCheck = async () => {
      // Check if schools exist
      try {
        const snap = await getDocs(query(collection(db, "schools"), limit(1)));
        if (snap.empty) {
          setIsFirstSetup(true);
        } else {
          setIsFirstSetup(false);
        }
      } catch (err) {
        console.error("Error checking schools existence:", err);
      } finally {
        setCheckingFirstSetup(false);
      }
    };

    runResetAndCheck();
  }, []);

  // 2. Fetch/Listen joining school document if joiningSchoolId is specified
  useEffect(() => {
    if (!joiningSchoolId) {
      setJoiningSchoolDoc(null);
      return;
    }
    setCheckingJoiningSchool(true);
    getDoc(doc(db, "schools", joiningSchoolId)).then((snap) => {
      if (snap.exists()) {
        setJoiningSchoolDoc({
          ...snap.data() as SchoolDoc,
          id: snap.id
        });
      } else {
        setJoiningSchoolDoc(null);
      }
      setCheckingJoiningSchool(false);
    }).catch((err) => {
      console.error("Error fetching joining school:", err);
      setCheckingJoiningSchool(false);
    });
  }, [joiningSchoolId]);

  // 3. Main Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.isAnonymous || user.email === "guest@school.edu") {
          await signOut(auth);
          return;
        }
        setCurrentUser(user);

        // Ensure user base doc exists in global "users" collection
        const uRef = doc(db, "users", user.uid);
        const uSnap = await getDoc(uRef);
        if (!uSnap.exists()) {
          await setDoc(uRef, {
            email: user.email || "",
            displayName: user.displayName || "Member",
            photoURL: user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName || "Member")}`,
            createdAt: Timestamp.now()
          });
        }
      } else {
        setCurrentUser(null);
        setMySchools([]);
        setCurrentSchoolId(null);
        setCurrentSchool(null);
        setUserRole(null);
        setAlumniStatus(null);
        setMembershipStatus(null);
        setIsOnboarding(false);
        setLoadingAuth(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 4. Listen to memberships for logged-in user
  useEffect(() => {
    if (!currentUser) return;

    setLoadingMemberships(true);
    const q = query(
      collection(db, "memberships"),
      where("userId", "==", currentUser.uid)
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      try {
        const schoolsList: SchoolDoc[] = [];
        const membershipsList: MembershipDoc[] = [];
        for (const docSnap of snapshot.docs) {
          const mData = docSnap.data() as MembershipDoc;
          if (mData.status === "revoked" || mData.status === "rejected") {
            continue;
          }
          membershipsList.push(mData);
          const sSnap = await getDoc(doc(db, "schools", mData.schoolId));
          if (sSnap.exists()) {
            const sData = sSnap.data() as SchoolDoc;
            schoolsList.push({
              ...sData,
              id: sSnap.id
            });
          }
        }
        setMyMemberships(membershipsList);
        setMySchools(schoolsList);

        // Auto-select school if there is exactly 1 and no school currently selected
        if (schoolsList.length === 1 && !currentSchoolId) {
          setCurrentSchoolId(schoolsList[0].id);
        }
        setLoadingMemberships(false);
        setLoadingAuth(false);
      } catch (err) {
        console.error("Error loading user memberships:", err);
        setLoadingMemberships(false);
        setLoadingAuth(false);
      }
    }, (error) => {
      console.error("Memberships listener error:", error);
      setLoadingMemberships(false);
      setLoadingAuth(false);
    });

    return () => unsub();
  }, [currentUser, currentSchoolId]);

  // 4b. Auto-redirect or handle logged-in state transitions
  useEffect(() => {
    if (!currentUser) return;

    // A. Check if they clicked "Create School Network" but already administer one
    if (landingChoice === "create") {
      const adminSchool = mySchools.find(s => {
        const membership = myMemberships.find(m => m.schoolId === s.id);
        return membership?.role === "admin";
      });
      if (adminSchool) {
        setCurrentSchoolId(adminSchool.id);
        setLandingChoice(null);
      }
    }

    // B. Check if they opened an invite link
    if (joiningSchoolId && !loadingMemberships) {
      const existingMembership = myMemberships.find(m => m.schoolId === joiningSchoolId);
      if (existingMembership) {
        // Already a member of this school: send them to this school's portal
        setCurrentSchoolId(joiningSchoolId);
        setJoiningSchoolId(null);
        setJoiningSchoolRole(null);
        sessionStorage.removeItem("alumniconnect_pending_join_id");
        sessionStorage.removeItem("alumniconnect_pending_join_role");
        localStorage.removeItem("alumniconnect_pending_join");
      } else {
        // Not a member of this school yet
        if (joiningSchoolRole) {
          // If a role was pre-selected in the URL, auto-join now
          handleJoinSchool(joiningSchoolRole);
        } else {
          // If no role is pre-selected, let the Case 1 render block do its work
          // to let them choose whether they are a student or alumnus.
        }
      }
    }
  }, [currentUser, landingChoice, joiningSchoolId, joiningSchoolRole, mySchools, myMemberships, loadingMemberships]);

  // 5. Update currentSchoolDoc whenever currentSchoolId changes, and listen to role/approval status
  useEffect(() => {
    let unsubAlumni: (() => void) | null = null;

    if (!currentSchoolId || !currentUser) {
      setCurrentSchool(null);
      setUserRole(null);
      setAlumniStatus(null);
      setMembershipStatus(null);
      setIsOnboarding(false);
      setRevocationStatus(null);
      return;
    }

    // Resolve school document
    getDoc(doc(db, "schools", currentSchoolId)).then((snap) => {
      if (snap.exists()) {
        setCurrentSchool({
          ...snap.data() as SchoolDoc,
          id: snap.id
        });
      }
    });

    // Listen to membership role for this school
    const mRef = doc(db, "memberships", `${currentSchoolId}_${currentUser.uid}`);
    const unsubMembership = onSnapshot(mRef, async (mSnap) => {
      // Clean up previous alumni listener if any
      if (unsubAlumni) {
        unsubAlumni();
        unsubAlumni = null;
      }

      if (mSnap.exists()) {
        const mData = mSnap.data() as MembershipDoc;
        setMembershipStatus(mData.status);
        if (mData.status === "revoked" || mData.status === "rejected") {
          setUserRole(null);
          setAlumniStatus(null);
          setRevocationStatus(mData.status);
          return;
        }
        setRevocationStatus(null);
        setUserRole(mData.role);

        // Check onboarding status
        if (mData.role === "student") {
          const sSnap = await getDoc(doc(db, "studentProfiles", `${currentSchoolId}_${currentUser.uid}`));
          if (!sSnap.exists()) {
            setIsOnboarding(true);
          } else {
            setIsOnboarding(false);
          }
        } else if (mData.role === "alumnus") {
          // Listen to alumni profile for approval status
          const aRef = doc(db, "alumniProfiles", `${currentSchoolId}_${currentUser.uid}`);
          unsubAlumni = onSnapshot(aRef, (aSnap) => {
            if (aSnap.exists()) {
              const aData = aSnap.data() as any;
              setAlumniStatus(aData.approvalStatus || "pending");
              setIsOnboarding(false);
            } else {
              setIsOnboarding(true);
            }
          });
        } else if (mData.role === "admin") {
          setIsOnboarding(false);
        }
      } else {
        // No membership yet for this school - might be joining
        setUserRole(null);
        setAlumniStatus(null);
        setMembershipStatus(null);
        setRevocationStatus(null);
      }
    });

    return () => {
      unsubMembership();
      if (unsubAlumni) {
        unsubAlumni();
      }
    };
  }, [currentSchoolId, currentUser]);

  // 6. Listen to pending mentorship requests count for current approved Alumnus
  useEffect(() => {
    if (!currentUser || !currentSchoolId || userRole !== "alumnus" || alumniStatus !== "approved") {
      setPendingRequestsCount(0);
      return;
    }

    const reqsQuery = query(
      collection(db, "mentorshipRequests"),
      where("schoolId", "==", currentSchoolId),
      where("alumnusId", "==", currentUser.uid),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(reqsQuery, (snapshot) => {
      setPendingRequestsCount(snapshot.size);
    });

    return () => unsub();
  }, [currentUser, currentSchoolId, userRole, alumniStatus]);

  // 7. Route & URL History Synchronization
  useEffect(() => {
    const handleUrlSync = () => {
      const path = window.location.pathname;
      let targetPath = "/";

      if (!currentUser) {
        targetPath = "/login";
      } else {
        if (currentSchoolId) {
          if (currentTab === "profile") {
            targetPath = "/profile";
          } else if (currentTab === "messages") {
            targetPath = "/messages";
          } else if (currentTab === "opportunities") {
            targetPath = "/opportunities";
          } else if (currentTab === "announcements") {
            targetPath = "/announcements";
          } else if (currentTab === "directory") {
            targetPath = "/directory";
          } else if (currentTab === "student-directory") {
            targetPath = "/student-directory";
          } else if (currentTab === "requests") {
            targetPath = "/requests";
          } else {
            targetPath = "/dashboard";
          }
        } else {
          targetPath = "/";
        }
      }

      if (path !== targetPath) {
        window.history.pushState(null, "", targetPath);
      }
    };

    handleUrlSync();
  }, [currentUser, currentTab, currentSchoolId]);

  // 8. Listen to browser Back/Forward (popstate) navigation events
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;

      // Parse tabs
      if (path === "/profile") {
        setCurrentTab("profile");
      } else if (path === "/messages") {
        setCurrentTab("messages");
      } else if (path === "/opportunities") {
        setCurrentTab("opportunities");
      } else if (path === "/announcements") {
        setCurrentTab("announcements");
      } else if (path === "/directory") {
        setCurrentTab("directory");
      } else if (path === "/student-directory") {
        setCurrentTab("student-directory");
      } else if (path === "/requests") {
        setCurrentTab("requests");
      } else if (path === "/dashboard" || path === "/") {
        setCurrentTab("dashboard");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // 9. Redirect to the initial deep-linked tab after successful auth
  useEffect(() => {
    if (currentUser && initialRedirectPath) {
      if (initialRedirectPath === "/profile") {
        setCurrentTab("profile");
      } else if (initialRedirectPath === "/messages") {
        setCurrentTab("messages");
      } else if (initialRedirectPath === "/opportunities") {
        setCurrentTab("opportunities");
      } else if (initialRedirectPath === "/announcements") {
        setCurrentTab("announcements");
      } else if (initialRedirectPath === "/directory") {
        setCurrentTab("directory");
      } else if (initialRedirectPath === "/student-directory") {
        setCurrentTab("student-directory");
      } else if (initialRedirectPath === "/requests") {
        setCurrentTab("requests");
      }
      setInitialRedirectPath(null);
    }
  }, [currentUser, initialRedirectPath]);

  // Authenticator Functions
  const validateEmail = (val: string) => {
    if (!val.trim()) {
      setEmailError("Email is required.");
      return false;
    }
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(val.trim())) {
      setEmailError("Please enter a valid email address.");
      return false;
    }
    setEmailError("");
    return true;
  };

  const validateFullName = (val: string) => {
    if (isSignUp && !val.trim()) {
      setFullNameError("Full name is required.");
      return false;
    }
    setFullNameError("");
    return true;
  };

  const validatePassword = (val: string) => {
    if (!val) {
      setPasswordError("Password is required.");
      return false;
    }
    if (isSignUp) {
      if (val.length < 8 || !/\d/.test(val)) {
        setPasswordError("Use at least 8 characters, including a number.");
        return false;
      }
    }
    setPasswordError("");
    return true;
  };

  const validateConfirmPassword = (val: string) => {
    if (isSignUp) {
      if (!val) {
        setConfirmPasswordError("Please confirm your password.");
        return false;
      }
      if (val !== passwordInput) {
        setConfirmPasswordError("Those passwords don't match.");
        return false;
      }
    }
    setConfirmPasswordError("");
    return true;
  };

  const handleEmailBlur = () => {
    validateEmail(emailInput);
  };

  const handleFullNameBlur = () => {
    validateFullName(displayNameInput);
  };

  const handlePasswordBlur = () => {
    validatePassword(passwordInput);
  };

  const handleConfirmPasswordBlur = () => {
    validateConfirmPassword(confirmPasswordInput);
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    setAuthError("");
    setGoogleSigningIn(true);
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.warn("Google sign in failed:", error);
      const code = error?.code || "";
      const msg = error?.message || "";
      
      const isCancelled = 
        code === "auth/cancelled-popup-request" || 
        code === "auth/popup-closed-by-user" || 
        msg.includes("cancelled-popup-request") ||
        msg.includes("popup-closed-by-user");
      
      if (isCancelled) {
        // Silently reset, no error shown
        return;
      }
      
      if (code === "auth/popup-blocked" || msg.includes("popup-blocked")) {
        setAuthError(
          "The Sign-In popup was blocked by your browser. Please enable popups, click the 'Open in New Tab' icon in the top-right corner, or use the email form."
        );
      } else if (code === "auth/operation-not-allowed" || msg.includes("operation-not-allowed")) {
        setAuthError(
          "Google Sign-In is not enabled for this Firebase project. To enable it: Go to your Firebase Console -> Authentication -> Sign-in method, click 'Add new provider', and enable 'Google'."
        );
      } else {
        setAuthError(
          `Authentication failed: ${msg || code || "Check your connection and try again."}`
        );
      }
    } finally {
      setGoogleSigningIn(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    // Validate email, password, etc.
    const isEmailValid = validateEmail(emailInput);
    const isPasswordValid = validatePassword(passwordInput);
    const isNameValid = !isSignUp || validateFullName(displayNameInput);
    const isConfirmValid = !isSignUp || validateConfirmPassword(confirmPasswordInput);

    if (!isEmailValid || !isPasswordValid || !isNameValid || !isConfirmValid) {
      return;
    }

    setSigningIn(true);
    const email = emailInput.trim().toLowerCase();
    const password = passwordInput;

    try {
      if (isSignUp) {
        // Create account mode
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        if (credential.user) {
          const name = displayNameInput.trim() || email.split("@")[0];
          await setDoc(doc(db, "users", credential.user.uid), {
            email,
            displayName: name,
            photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
            createdAt: Timestamp.now()
          }, { merge: true });
        }
      } else {
        // Sign in mode
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.warn("Auth submit failed:", err);
      const code = err?.code || "";
      const message = err?.message || "";
      
      let mappedError = "Something went wrong. Check your connection and try again.";
      const isInvalidCred = 
        code === "auth/wrong-password" || 
        code === "auth/invalid-credential" || 
        code === "auth/invalid-login-credentials" ||
        message.includes("invalid-credential") ||
        message.includes("invalid-login-credentials") ||
        err?.toString().includes("invalid-credential");

      if (isInvalidCred) {
        mappedError = "Incorrect email or password. Please verify your credentials and try again, or reset your password below.";
      } else if (code === "auth/email-already-in-use") {
        mappedError = "An account already exists with this email. Try signing in instead.";
      } else if (code === "auth/user-not-found") {
        mappedError = "We couldn't find an account with that email. Want to create one?";
      } else if (code === "auth/weak-password") {
        mappedError = "Use at least 8 characters, including a number.";
      } else if (code === "auth/operation-not-allowed") {
        mappedError = "Email & Password sign-in is not enabled for this Firebase project. To enable it: Go to your Firebase Console -> Authentication -> Sign-in method, click 'Add new provider', and enable 'Email/Password'.";
      }
      setAuthError(mappedError);
    } finally {
      setSigningIn(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess(false);

    if (!forgotEmail.trim()) {
      setForgotError("Please enter your email address.");
      return;
    }

    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(forgotEmail.trim())) {
      setForgotError("Please enter a valid email address.");
      return;
    }

    setForgotLoading(true);
    try {
      await sendPasswordResetEmail(auth, forgotEmail.trim().toLowerCase());
      setForgotSuccess(true);
    } catch (err: any) {
      console.error("Password reset error:", err);
      const code = err?.code || "";
      if (code === "auth/user-not-found") {
        setForgotError("We couldn't find an account with that email. Want to create one?");
      } else {
        setForgotError("Something went wrong. Check your connection and try again.");
      }
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  // Handlers for Onboarding and Join flows
  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupSchoolName.trim() || !currentUser) return;
    setSavingSetup(true);
    try {
      const schoolId = `school_${Date.now()}`;
      const prefix = setupSchoolName.replace(/[^a-zA-Z]/g, "").substring(0, 3).toUpperCase() || "SCH";

      await runTransaction(db, async (transaction) => {
        let code = "";
        let codeRef;
        for (let attempt = 0; attempt < 10; attempt++) {
          const candidate = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
          const candidateRef = doc(db, "schoolCodes", candidate);
          const candidateSnap = await transaction.get(candidateRef);
          if (!candidateSnap.exists()) {
            code = candidate;
            codeRef = candidateRef;
            break;
          }
        }
        if (!code || !codeRef) {
          throw new Error("Could not generate a unique school code, please try again.");
        }

        transaction.set(codeRef, { schoolId });
        transaction.set(doc(db, "schools", schoolId), {
          id: schoolId,
          name: setupSchoolName.trim(),
          description: setupSchoolDesc.trim() || "Private School Directory and Mentorship network.",
          schoolCode: code,
          country: setupCountry.trim(),
          city: setupCity.trim(),
          logoUrl: setupLogoUrl.trim() || "",
          createdBy: currentUser.uid,
          createdAt: Timestamp.now()
        });
        transaction.set(doc(db, "memberships", `${schoolId}_${currentUser.uid}`), {
          schoolId,
          userId: currentUser.uid,
          role: "admin",
          status: "active",
          createdAt: Timestamp.now()
        });
      });

      await setDoc(doc(db, "users", currentUser.uid), {
        email: currentUser.email || "",
        displayName: currentUser.displayName || "Member",
        photoURL: currentUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.displayName || "Member")}`,
        createdAt: Timestamp.now(),
        role: "admin"
      }, { merge: true });

      setLandingChoice(null);
      setCurrentSchoolId(schoolId);
    } catch (err: any) {
      console.error(err);
      alert("Error initializing network: " + err.message);
    } finally {
      setSavingSetup(false);
    }
  };

  async function handleJoinSchool(selectedRole: "student" | "alumnus") {
    if (!currentUser || !joiningSchoolId) return;
    try {
      await setDoc(doc(db, "memberships", `${joiningSchoolId}_${currentUser.uid}`), {
        schoolId: joiningSchoolId,
        userId: currentUser.uid,
        role: selectedRole,
        status: "pending",
        createdAt: Timestamp.now()
      });

      await setDoc(doc(db, "users", currentUser.uid), {
        email: currentUser.email || "",
        displayName: currentUser.displayName || "Member",
        photoURL: currentUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser.displayName || "Member")}`,
        createdAt: Timestamp.now(),
        role: selectedRole
      }, { merge: true });

      localStorage.removeItem("alumniconnect_pending_join");
      sessionStorage.removeItem("alumniconnect_pending_join_id");
      sessionStorage.removeItem("alumniconnect_pending_join_role");
      setCurrentSchoolId(joiningSchoolId);
      setJoiningSchoolId(null);
      setJoiningSchoolRole(null);
    } catch (err: any) {
      console.error(err);
      alert("Error joining school: " + err.message);
    }
  }

  const handleResolvePaste = async (e: React.FormEvent) => {
    e.preventDefault();
    setSchoolCodeError("");
    const trimmed = enteredSchoolCode.trim();
    if (!trimmed) return;

    setResolvingCode(true);
    try {
      const codeToSearch = trimmed.toUpperCase();
      const codeSnap = await getDoc(doc(db, "schoolCodes", codeToSearch));
      if (!codeSnap.exists()) {
        setSchoolCodeError("School code not found. Please contact your administrator.");
        return;
      }
      const matchedSchoolId = codeSnap.data().schoolId as string;

      // Verify if user already has a membership in this school
      const mRef = doc(db, "memberships", `${matchedSchoolId}_${currentUser!.uid}`);
      const mSnap = await getDoc(mRef);
      if (mSnap.exists()) {
        const mData = mSnap.data() as MembershipDoc;
        if (mData.status === "revoked") {
          setSchoolCodeError("Your membership access in this school has been revoked by the administrator.");
          return;
        }
        if (mData.status === "rejected") {
          setSchoolCodeError("Your join request for this school has been rejected by the administrator.");
          return;
        }
        if (mData.status === "pending") {
          setSchoolCodeError("Your registration request for this school is currently pending approval.");
          return;
        }
        if (mData.status === "active") {
          // They are already an active member, auto-switch to this school portal!
          setCurrentSchoolId(matchedSchoolId);
          setEnteredSchoolCode("");
          setLandingChoice(null);
          return;
        }
      }

      setJoiningSchoolId(matchedSchoolId);
      setJoiningSchoolRole(null);
    } catch (err: any) {
      console.error("Error looking up school code:", err);
      setSchoolCodeError("Failed to lookup code: " + err.message);
    } finally {
      setResolvingCode(false);
    }
  };

  if (checkingFirstSetup || checkingJoiningSchool) {
    return (
      <div className="min-h-screen bg-[#FCFAF6] flex flex-col items-center justify-center p-4">
        <Loader className="w-10 h-10 text-[#1C1A17] animate-spin mb-4" />
        <span className="text-stone-500 text-xs font-mono tracking-wider uppercase">Loading network config...</span>
      </div>
    );
  }

  // Renders for different application states
  if (loadingAuth || checkingFirstSetup || checkingJoiningSchool) {
    return (
      <div className="min-h-screen bg-[#1E293B] flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-none border border-slate-700 bg-slate-800 text-[#FAF7F2] font-serif italic text-3xl font-bold flex items-center justify-center mx-auto shadow-xl animate-pulse">
            AC
          </div>
          <h1 className="text-2xl font-serif font-bold text-white tracking-tight leading-none">AlumniConnect</h1>
          <div className="flex items-center justify-center space-x-2 pt-2">
            <Loader className="w-4 h-4 text-amber-500 animate-spin" />
            <span className="text-slate-400 text-xs font-mono tracking-widest uppercase">Initializing Portal...</span>
          </div>
        </div>
      </div>
    );
  }

  // CASE 1: DIRECT SCHOOL INVITATION LINK VALIDATION
  if (joiningSchoolId && !joiningSchoolDoc) {
    return (
      <div className="min-h-screen bg-[#FCFAF6] flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-stone-200 p-8 max-w-md w-full text-center space-y-4 shadow-md">
          <Building2 className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-serif font-bold text-stone-900">This invitation is no longer valid.</h2>
          <p className="text-xs text-stone-500 leading-relaxed">
            The school portal you are trying to join could not be found, has been removed, or the link has expired. Please verify with your school administrator or ensure the URL was copied correctly.
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                setJoiningSchoolId(null);
                localStorage.removeItem("alumniconnect_pending_join");
                window.history.pushState(null, "", "/login");
              }}
              className="px-5 py-2.5 bg-[#1C1A17] hover:bg-[#2E2B27] text-white font-mono text-[10px] font-bold uppercase tracking-wider rounded-none transition-colors cursor-pointer"
            >
              Go to Home Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  // UNIFIED AUTHENTICATION REDESIGN (Single Screen, Two Modes for both direct invite and homepage gateways)
  if (!currentUser) {
    return (
      <div className="min-h-screen grid grid-cols-1 md:grid-cols-12 bg-[#FCFAF6] relative">
        {/* LEFT PANEL - Navy Column (desktop only) */}
        <div className="hidden md:flex md:col-span-5 bg-[#1E293B] flex-col justify-between p-12 text-white border-r border-slate-800 relative overflow-hidden">
          {/* Subtle ambient light overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 pointer-events-none" />
          
          <div className="relative z-10 space-y-8">
            {/* Logo Monogram */}
            <div className="w-12 h-12 rounded-none border border-slate-700 bg-slate-800 text-[#FAF7F2] font-serif italic text-xl font-bold flex items-center justify-center shadow-lg">
              {joiningSchoolDoc ? joiningSchoolDoc.name.substring(0, 2).toUpperCase() : "AC"}
            </div>

            {joiningSchoolDoc ? (
              <div className="space-y-4">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400 bg-amber-400/10 px-2.5 py-0.5 border border-amber-400/20">
                  Community Invitation
                </span>
                <h1 className="text-3xl font-serif font-bold tracking-tight text-white leading-tight">
                  Join {joiningSchoolDoc.name}
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {joiningSchoolDoc.description || "You have been invited to register and join your school's private professional directory and mentor hub."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <h1 className="text-3xl font-serif font-bold tracking-tight text-white leading-tight">
                  AlumniConnect
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  A structured network turning your school's alumni into accessible career mentors.
                </p>
              </div>
            )}

            {/* Feature lists for high-end feel */}
            <div className="space-y-4 pt-6 border-t border-slate-800">
              <div className="flex items-start space-x-3 text-sm">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-100">Direct Mentorship</h4>
                  <p className="text-xs text-slate-400 leading-normal">Message verified alumni mentors directly from your secure student hub.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 text-sm">
                <BookOpen className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-100">Career Journeys</h4>
                  <p className="text-xs text-slate-400 leading-normal">Browse real historical pathway maps, step-by-step histories, and mentoring prompts.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 text-sm">
                <Briefcase className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-100">Private Boards</h4>
                  <p className="text-xs text-slate-400 leading-normal">Discover exclusive professional opportunities, job postings, and academy updates.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 text-[10px] font-mono text-slate-500 tracking-wider">
            © {new Date().getFullYear()} AlumniConnect Portal. All rights reserved.
          </div>
        </div>

        {/* RIGHT PANEL - Authentication Card (centered) */}
        <div className="col-span-1 md:col-span-7 flex flex-col justify-center items-center p-6 sm:p-12 md:p-16 lg:p-24 w-full">
          <div className="max-w-md w-full space-y-8 bg-white border border-stone-200/80 p-8 shadow-md">
            
            {/* Header: Network Logo / Title & Headline */}
            {joiningSchoolDoc ? (
              <div className="text-center space-y-4 pb-4 border-b border-stone-100">
                {/* School Logo / Monogram */}
                <div className="w-16 h-16 rounded-full bg-[#1E293B] text-amber-400 font-serif italic text-2xl font-bold flex items-center justify-center shadow-md mx-auto border-2 border-stone-100 animate-fade-in">
                  {joiningSchoolDoc.name.substring(0, 2).toUpperCase()}
                </div>
                
                <div className="space-y-1">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-amber-800 bg-amber-50 px-2.5 py-0.5 border border-amber-200/50">
                    Community Invitation
                  </span>
                  <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight leading-tight">
                    Join {joiningSchoolDoc.name}
                  </h2>
                  <p className="text-xs text-stone-500 leading-relaxed max-w-sm mx-auto">
                    {joiningSchoolDoc.description || "You have been invited to register and join your school's private professional directory and mentor hub."}
                  </p>
                </div>

                <div className="p-3 bg-stone-50 border border-stone-100/80 text-[11px] text-stone-600 leading-normal text-left">
                  🌟 <strong>Welcome Message:</strong> This is a secure portal for students and alumni. Connect with mentors, browse career paths, and message verified members. Sign in below to accept this invitation.
                </div>
              </div>
            ) : (
              <div className="text-center md:text-left space-y-2">
                <div className="md:hidden w-10 h-10 rounded-none border border-slate-700 bg-[#1E293B] text-white font-serif italic text-lg font-bold flex items-center justify-center shadow-md mx-auto mb-4">
                  AC
                </div>

                <h2 className="text-2xl font-serif font-bold text-stone-950 tracking-tight">
                  {isSignUp ? "Create your account" : "Welcome back"}
                </h2>
                <p className="text-xs text-stone-500">
                  {isSignUp 
                    ? "Enter your credentials to get started with the network" 
                    : "Sign in to access your secure community dashboard"
                  }
                </p>
              </div>
            )}

            {/* Top-level Banner for Account Errors */}
            {authError && (
              <div className="p-3.5 bg-red-50 text-red-700 text-xs border border-red-100">
                {authError}
              </div>
            )}

            {/* Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleSigningIn || signingIn}
              className="w-full bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-sans text-xs font-semibold py-3 px-4 flex items-center justify-center space-x-3 transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
            >
              {googleSigningIn ? (
                <Loader className="w-4 h-4 text-stone-600 animate-spin" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              )}
              <span>{googleSigningIn ? "Connecting..." : "Continue with Google"}</span>
            </button>

            {/* Plain Or Divider */}
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-stone-200"></div>
              <span className="flex-shrink mx-4 text-stone-400 text-[10px] font-mono uppercase tracking-widest">or</span>
              <div className="flex-grow border-t border-stone-200"></div>
            </div>

            {/* Email Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              
              {/* Email */}
              <div className="space-y-1">
                <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-3.5 h-3.5 text-stone-400" />
                  <input
                    type="email"
                    required
                    disabled={signingIn || googleSigningIn}
                    placeholder="you@school.edu"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      if (emailError) validateEmail(e.target.value);
                    }}
                    onBlur={handleEmailBlur}
                    className={`w-full text-stone-900 bg-stone-50 border ${
                      emailError ? "border-red-300 focus:border-red-500" : "border-stone-200 focus:border-stone-900"
                    } rounded-none pl-9 pr-3 py-2 text-xs focus:bg-white focus:outline-none transition-colors disabled:opacity-60`}
                  />
                </div>
                {emailError && (
                  <p className="text-[10px] text-red-600 mt-1">{emailError}</p>
                )}
              </div>

              {/* Full Name - Signup Only */}
              {isSignUp && (
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required={isSignUp}
                    disabled={signingIn || googleSigningIn}
                    placeholder="e.g. Alex Rivera"
                    value={displayNameInput}
                    onChange={(e) => {
                      setDisplayNameInput(e.target.value);
                      if (fullNameError) validateFullName(e.target.value);
                    }}
                    onBlur={handleFullNameBlur}
                    className={`w-full text-stone-900 bg-stone-50 border ${
                      fullNameError ? "border-red-300 focus:border-red-500" : "border-stone-200 focus:border-stone-900"
                    } rounded-none px-3 py-2 text-xs focus:bg-white focus:outline-none transition-colors disabled:opacity-60`}
                  />
                  {fullNameError && (
                    <p className="text-[10px] text-red-600 mt-1">{fullNameError}</p>
                  )}
                </div>
              )}

              {/* Password */}
              <div className="space-y-1">
                <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-3.5 h-3.5 text-stone-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    disabled={signingIn || googleSigningIn}
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (passwordError) validatePassword(e.target.value);
                    }}
                    onBlur={handlePasswordBlur}
                    className={`w-full text-stone-900 bg-stone-50 border ${
                      passwordError ? "border-red-300 focus:border-red-500" : "border-stone-200 focus:border-stone-900"
                    } rounded-none pl-9 pr-10 py-2 text-xs focus:bg-white focus:outline-none transition-colors disabled:opacity-60`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600 focus:outline-none cursor-pointer"
                    title={showPassword ? "Hide Password" : "Show Password"}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {/* Requirements / Helpers */}
                {isSignUp && !passwordError ? (
                  <p className="text-[10px] text-stone-500 mt-1">
                    At least 8 characters, including a number
                  </p>
                ) : null}
                {passwordError && (
                  <p className="text-[10px] text-red-600 mt-1">{passwordError}</p>
                )}
              </div>

              {/* Confirm Password - Signup Only */}
              {isSignUp && (
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-3.5 h-3.5 text-stone-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required={isSignUp}
                      disabled={signingIn || googleSigningIn}
                      placeholder="••••••••"
                      value={confirmPasswordInput}
                      onChange={(e) => {
                        setConfirmPasswordInput(e.target.value);
                        if (confirmPasswordError) validateConfirmPassword(e.target.value);
                      }}
                      onBlur={handleConfirmPasswordBlur}
                      className={`w-full text-stone-900 bg-stone-50 border ${
                        confirmPasswordError ? "border-red-300 focus:border-red-500" : "border-stone-200 focus:border-stone-900"
                      } rounded-none pl-9 pr-3 py-2 text-xs focus:bg-white focus:outline-none transition-colors disabled:opacity-60`}
                    />
                  </div>
                  {confirmPasswordError && (
                    <p className="text-[10px] text-red-600 mt-1">{confirmPasswordError}</p>
                  )}
                </div>
              )}

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={signingIn || googleSigningIn}
                className="w-full bg-[#1E293B] hover:bg-slate-800 text-white font-mono text-xs font-semibold uppercase tracking-wider py-3.5 rounded-none flex items-center justify-center space-x-2 transition-colors disabled:opacity-60 cursor-pointer"
              >
                {signingIn ? (
                  <Loader className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <span>{isSignUp ? "Create Account" : "Sign In"}</span>
                )}
              </button>
            </form>

            {/* Forgot Password link - Sign In mode only */}
            {!isSignUp && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setForgotSuccess(false);
                    setForgotError("");
                  }}
                  className="text-stone-500 hover:text-stone-900 text-xs font-mono font-medium hover:underline focus:outline-none cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Toggle bottom link */}
            <div className="text-center pt-4 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setAuthError("");
                  // Clear errors
                  setEmailError("");
                  setFullNameError("");
                  setPasswordError("");
                  setConfirmPasswordError("");
                }}
                className="text-xs font-mono text-stone-500 hover:text-stone-900 font-medium hover:underline transition-colors focus:outline-none cursor-pointer"
              >
                {isSignUp 
                  ? "Already have an account? Sign in" 
                  : "Don't have an account? Sign up"
                }
              </button>
            </div>

            {/* Cancel Joining Option */}
            {joiningSchoolId && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setJoiningSchoolId(null);
                    localStorage.removeItem("alumniconnect_pending_join");
                  }}
                  className="text-stone-400 hover:text-stone-700 font-mono text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
                >
                  ← Cancel Invitation & Return Home
                </button>
              </div>
            )}

          </div>
        </div>

        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white border border-stone-200 shadow-2xl p-6 md:p-8 max-w-sm w-full relative">
              <button 
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotSuccess(false);
                  setForgotError("");
                  setForgotEmail("");
                }}
                className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 text-sm font-mono cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>

              {!forgotSuccess ? (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-lg font-serif font-bold text-stone-900">Reset your password</h3>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      Enter your email address and we will send you a secure link to reset your password.
                    </p>
                  </div>

                  {forgotError && (
                    <div className="p-3 bg-red-50 text-red-700 text-xs border border-red-100">
                      {forgotError}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 w-3.5 h-3.5 text-stone-400" />
                      <input
                        type="email"
                        required
                        placeholder="you@school.edu"
                        value={forgotEmail}
                        onChange={(e) => {
                          setForgotEmail(e.target.value);
                          setForgotError("");
                        }}
                        className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none pl-9 pr-3 py-2 text-xs focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full bg-[#1E293B] hover:bg-slate-800 text-white font-mono text-xs font-semibold uppercase tracking-wider py-3.5 rounded-none flex items-center justify-center space-x-2 cursor-pointer transition-colors"
                  >
                    {forgotLoading ? <Loader className="w-4 h-4 animate-spin" /> : <span>Send reset link</span>}
                  </button>
                </form>
              ) : (
                <div className="space-y-4 text-center py-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-none border border-emerald-100 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-serif font-bold text-stone-900">Link sent</h3>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      Check your inbox for a link to reset your password.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotSuccess(false);
                      setForgotEmail("");
                    }}
                    className="w-full bg-[#1E293B] hover:bg-slate-800 text-white font-mono text-xs font-semibold uppercase tracking-wider py-3 rounded-none cursor-pointer transition-colors"
                  >
                    Back to Sign In
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    );
  }

  // CASE 1: DIRECT SCHOOL INVITATION ROLE SELECTION (For logged-in users who still need to choose role)
  if (joiningSchoolId) {
    if (checkingJoiningSchool) {
      return (
        <div className="min-h-screen bg-[#FCFAF6] flex flex-col items-center justify-center p-4">
          <Loader className="w-8 h-8 text-[#1C1A17] animate-spin mb-4" />
          <span className="text-stone-500 text-xs font-mono uppercase tracking-wider">Verifying invitation...</span>
        </div>
      );
    }

    if (!joiningSchoolDoc) {
      return (
        <div className="min-h-screen bg-[#FCFAF6] flex flex-col items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-none max-w-md w-full p-6 md:p-8 shadow-sm text-center space-y-4">
            <div className="w-12 h-12 bg-red-50 text-red-700 border border-red-100 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-serif font-bold text-stone-900">Invalid Invitation Link</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              This school network does not exist or the invitation has been deactivated. Please contact your school administrator.
            </p>
            <button
              onClick={() => {
                setJoiningSchoolId(null);
                setJoiningSchoolRole(null);
                sessionStorage.removeItem("alumniconnect_pending_join_id");
                sessionStorage.removeItem("alumniconnect_pending_join_role");
                localStorage.removeItem("alumniconnect_pending_join");
              }}
              className="w-full bg-[#1C1A17] hover:bg-[#2E2B27] text-white font-mono text-xs font-semibold uppercase tracking-wider py-3 rounded-none cursor-pointer"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#FCFAF6] flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-stone-200 rounded-none max-w-lg w-full p-6 md:p-8 shadow-sm space-y-6">
          <div className="text-center space-y-2 border-b border-stone-100 pb-4">
            <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">Select registration type</h2>
            <p className="text-xs text-stone-500">How are you joining {joiningSchoolDoc.name} today?</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => handleJoinSchool("student")}
              className="border border-stone-200 hover:border-stone-900 hover:bg-stone-50/50 p-5 rounded-none text-left space-y-3 transition-all group cursor-pointer"
            >
              <div className="p-3 bg-stone-100 text-stone-700 rounded-none w-fit group-hover:bg-stone-200">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-serif font-semibold text-stone-900 text-sm">I'm a Student</h4>
                <p className="text-[11px] text-stone-500 leading-relaxed">Immediate access to browse alumni, read paths, and request career help.</p>
              </div>
            </button>

            <button
              onClick={() => handleJoinSchool("alumnus")}
              className="border border-stone-200 hover:border-stone-900 hover:bg-stone-50/50 p-5 rounded-none text-left space-y-3 transition-all group cursor-pointer"
            >
              <div className="p-3 bg-stone-100 text-stone-700 rounded-none w-fit group-hover:bg-stone-200">
                <Briefcase className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-serif font-semibold text-stone-900 text-sm">I'm an Alumnus</h4>
                <p className="text-[11px] text-stone-500 leading-relaxed">Build your mentor profile, answer journey prompts, and share listings.</p>
              </div>
            </button>
          </div>

          <div className="pt-4 border-t border-stone-100 flex justify-between items-center text-xs">
            <span className="text-stone-400">Signed in as {currentUser.displayName || currentUser.email}</span>
            <button onClick={handleLogout} className="text-red-700 font-bold hover:underline uppercase tracking-wide text-[10px]">
              Cancel & Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // CASE 3: AUTHENTICATED BUT NO SPECIFIC ACTIVE SCHOOL GATEWAY RESOLVED
  if (!currentSchoolId) {
    if (loadingMemberships) {
      return (
        <div className="min-h-screen bg-[#FCFAF6] flex flex-col items-center justify-center p-4">
          <Loader className="w-8 h-8 text-[#1C1A17] animate-spin mb-4" />
          <span className="text-stone-500 text-xs font-mono uppercase tracking-wider">Syncing school gateways...</span>
        </div>
      );
    }

    if (mySchools.length === 0) {
      if (landingChoice === "create") {
        return (
          <div className="min-h-screen bg-[#FCFAF6] flex flex-col items-center justify-center p-4">
            <div className="bg-white border border-stone-200 rounded-none max-w-md w-full p-6 md:p-8 shadow-sm space-y-6">
              <div className="text-center space-y-2">
                <Building2 className="w-10 h-10 text-stone-700 mx-auto" />
                <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">Create School Network</h2>
                <p className="text-xs text-stone-500">Set up the brand-new private AlumniConnect network for your school.</p>
              </div>

              <form onSubmit={handleCreateSchool} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">School Name</label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    placeholder="e.g. Boston Institute of Technology"
                    value={setupSchoolName}
                    onChange={(e) => setSetupSchoolName(e.target.value)}
                    className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">Description</label>
                  <input
                    type="text"
                    required
                    maxLength={150}
                    placeholder="e.g. Connecting BIT students with global alumni mentors."
                    value={setupSchoolDesc}
                    onChange={(e) => setSetupSchoolDesc(e.target.value)}
                    className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">Country</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. United States"
                      value={setupCountry}
                      onChange={(e) => setSetupCountry(e.target.value)}
                      className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">City / Region</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Boston"
                      value={setupCity}
                      onChange={(e) => setSetupCity(e.target.value)}
                      className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">School Logo URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="e.g. https://example.com/logo.png"
                    value={setupLogoUrl}
                    onChange={(e) => setSetupLogoUrl(e.target.value)}
                    className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingSetup || !setupSchoolName.trim() || !setupCountry.trim() || !setupCity.trim()}
                  className="w-full bg-[#1C1A17] hover:bg-[#2E2B27] text-[#FAF7F2] font-mono font-bold uppercase tracking-wide text-xs py-3 rounded-none shadow-sm transition-colors flex items-center justify-center space-x-2"
                >
                  {savingSetup ? <Loader className="w-4 h-4 animate-spin" /> : <span>Initialize Portal</span>}
                </button>
              </form>

              <div className="border-t border-stone-100 pt-4 flex justify-between items-center text-xs">
                <button onClick={() => setLandingChoice(null)} className="text-stone-600 font-mono text-[10px] uppercase font-semibold tracking-wide underline hover:text-stone-900">
                  ← Back
                </button>
                <button onClick={handleLogout} className="text-red-700 font-bold hover:underline uppercase tracking-wide text-[10px]">
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        );
      }

      if (landingChoice === "join") {
        return (
          <div className="min-h-screen bg-[#FCFAF6] flex flex-col items-center justify-center p-4">
            <div className="bg-white border border-stone-200 rounded-none max-w-md w-full p-6 md:p-8 shadow-sm space-y-6">
              <div className="text-center space-y-2">
                <Users className="w-10 h-10 text-stone-700 mx-auto" />
                <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">Join Existing School</h2>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Enter your school's unique permanent Access Code to join and select your network role.
                </p>
              </div>

              {schoolCodeError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-none border border-red-100">
                  {schoolCodeError}
                </div>
              )}

              <form onSubmit={handleResolvePaste} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">School Access Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BIT-8492"
                    value={enteredSchoolCode}
                    onChange={(e) => {
                      setEnteredSchoolCode(e.target.value);
                      setSchoolCodeError("");
                    }}
                    className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2.5 font-mono text-sm tracking-wider uppercase focus:bg-white focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={resolvingCode || !enteredSchoolCode.trim()}
                  className="w-full bg-[#1C1A17] hover:bg-[#2E2B27] text-white font-mono text-xs font-semibold uppercase tracking-wider py-3 rounded-none flex items-center justify-center space-x-2 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {resolvingCode ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Join Network</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="border-t border-stone-100 pt-4 flex justify-between items-center text-xs">
                <button onClick={() => setLandingChoice(null)} className="text-stone-600 font-mono text-[10px] uppercase font-semibold tracking-wide underline hover:text-stone-900">
                  ← Back
                </button>
                <button onClick={handleLogout} className="text-red-700 font-bold hover:underline uppercase tracking-wide text-[10px]">
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-[#FCFAF6] flex flex-col justify-center py-12 px-4">
          <div className="max-w-4xl w-full mx-auto space-y-12">
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-none border border-stone-200 bg-[#1C1A17] text-[#FAF7F2] font-serif italic text-2xl font-bold flex items-center justify-center mx-auto shadow-sm">
                AC
              </div>
              <h1 className="text-4xl sm:text-5xl font-serif font-bold text-stone-900 tracking-tight leading-none pt-2">AlumniConnect</h1>
              <p className="text-stone-500 text-sm max-w-md mx-auto leading-relaxed">
                Logged in as <strong className="text-stone-800">{currentUser.email}</strong>. Select an option to establish or join your school hub.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl w-full mx-auto pt-4">
              <div className="bg-white border border-stone-200 p-8 flex flex-col justify-between space-y-6 shadow-sm hover:border-stone-400 transition-all">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-700">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 border border-amber-100/40">For Administrators</span>
                    <h3 className="text-xl font-serif font-bold text-stone-900">Create a School Network</h3>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      Initialize a brand-new portal hub for your university, college, or high school association.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setLandingChoice("create")}
                  className="w-full bg-[#1C1A17] hover:bg-[#2E2B27] text-[#FAF7F2] font-mono text-xs font-semibold uppercase tracking-wider py-3 rounded-none transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
                >
                  <span>Create Network Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-white border border-stone-200 p-8 flex flex-col justify-between space-y-6 shadow-sm hover:border-stone-400 transition-all">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-700">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-600 bg-stone-50 px-2 py-0.5 border border-stone-200/50">For Students & Alumni</span>
                    <h3 className="text-xl font-serif font-bold text-stone-900">Join Existing School</h3>
                    <p className="text-xs text-stone-500 leading-relaxed">
                      Participate as a student or alumnus in an active hub using an invitation link.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setLandingChoice("join")}
                  className="w-full border border-stone-200 hover:bg-stone-50 text-stone-800 font-mono text-xs font-semibold uppercase tracking-wider py-3 transition-colors flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>Join school Hub</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-w-xs mx-auto border-t border-stone-100 pt-6 text-center">
              <button onClick={handleLogout} className="text-red-700 font-mono text-xs font-bold hover:underline uppercase tracking-wide">
                Logout from current account
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#FCFAF6] flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-stone-200 max-w-lg w-full p-6 md:p-8 space-y-6 shadow-sm">
          <div className="text-center space-y-2">
            <FolderSync className="w-10 h-10 text-stone-700 mx-auto" />
            <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">My School Portals</h2>
            <p className="text-sm text-stone-500">Your account holds active memberships in multiple school hubs:</p>
          </div>

          <div className="space-y-3">
            {mySchools.map((sch) => (
              <button
                key={sch.id}
                onClick={() => setCurrentSchoolId(sch.id)}
                className="w-full border border-stone-200 hover:border-stone-900 hover:bg-stone-50/50 p-4 rounded-none text-left flex items-center justify-between group transition-all cursor-pointer"
              >
                <div className="space-y-1">
                  <h4 className="font-serif font-bold text-stone-900 text-sm group-hover:underline">{sch.name}</h4>
                  <p className="text-xs text-stone-400 truncate max-w-xs">{sch.description}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-stone-900 group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-stone-100"></div>
            <span className="flex-shrink mx-4 text-stone-400 text-[9px] font-mono uppercase tracking-widest">Alternatives</span>
            <div className="flex-grow border-t border-stone-100"></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setLandingChoice("create");
              }}
              className="border border-stone-200 hover:border-stone-900 hover:bg-stone-50/50 p-3 text-center rounded-none font-mono text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Create Another Network
            </button>
            <button
              onClick={() => {
                setLandingChoice("join");
              }}
              className="border border-stone-200 hover:border-stone-900 hover:bg-stone-50/50 p-3 text-center rounded-none font-mono text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Join Another Network
            </button>
          </div>

          <div className="border-t border-stone-100 pt-4 flex justify-between items-center text-xs">
            <span className="text-stone-400">Logged in as {currentUser.email}</span>
            <button onClick={handleLogout} className="text-red-700 font-bold hover:underline uppercase tracking-wide text-[10px]">
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PROFILE ONBOARDING FORM (Required for new Student or Alumnus)
  if (isOnboarding) {
    return (
      <div className="min-h-screen bg-[#FCFAF6] py-12 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white p-4 rounded-none border border-stone-200 flex items-center justify-between text-xs shadow-sm">
            <span className="text-stone-500">
              Logged in as <strong className="text-stone-800">{currentUser?.displayName}</strong> ({userRole}) inside <strong>{currentSchool?.name}</strong>
            </span>
            <div className="flex space-x-3">
              {mySchools.length > 1 && (
                <button onClick={() => setCurrentSchoolId(null)} className="text-stone-600 font-mono text-[10px] uppercase font-semibold tracking-wide underline hover:text-stone-900">
                  Switch Portal
                </button>
              )}
              <button onClick={handleLogout} className="text-red-700 font-bold hover:underline uppercase tracking-wide text-[10px]">
                Sign Out
              </button>
            </div>
          </div>
          <ProfileForm 
            currentUserId={currentUser.uid}
            currentUserRole={userRole!}
            currentUserName={currentUser.displayName || "Anonymous"}
            schoolId={currentSchoolId}
            isOnboarding={true}
            onSaveCompleted={() => setIsOnboarding(false)}
          />
        </div>
      </div>
    );
  }

  // Access Revoked/Denied Screen
  if (currentSchoolId && revocationStatus) {
    return (
      <div className="min-h-screen bg-[#FCFAF6] flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-stone-200 rounded-none max-w-md w-full p-6 md:p-8 shadow-sm text-center space-y-6">
          <div className="w-12 h-12 bg-red-50 text-red-700 border border-red-100 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-serif font-bold text-stone-900">
              {revocationStatus === "revoked" ? "Access Revoked" : "Access Denied"}
            </h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              {revocationStatus === "revoked" 
                ? "Your membership access to this school network has been revoked by the portal administrator. If you believe this is an error, please contact your school administrator."
                : "Your registration request to join this school network has been rejected by the administrator."}
            </p>
          </div>
          <div className="space-y-2 pt-2">
            {mySchools.length > 1 && (
              <button
                onClick={() => {
                  setRevocationStatus(null);
                  setCurrentSchoolId(null);
                }}
                className="w-full bg-[#1C1A17] hover:bg-[#2E2B27] text-white font-mono text-xs font-semibold uppercase tracking-wider py-3 rounded-none cursor-pointer"
              >
                Switch School Portal
              </button>
            )}
            <button
              onClick={handleLogout}
              className="w-full border border-stone-200 hover:bg-stone-50 text-stone-800 font-mono text-xs font-semibold uppercase tracking-wider py-3 rounded-none cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render a clean loading/resolving screen if school portal is active but role hasn't resolved yet
  if (currentSchoolId && userRole === null) {
    return (
      <div className="min-h-screen bg-[#FCFAF6] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader className="w-8 h-8 text-stone-800 animate-spin mx-auto" />
          <p className="font-mono text-xs uppercase tracking-wider text-stone-500">Resolving Portal Membership...</p>
        </div>
      </div>
    );
  }

  // DASHBOARD LAYOUT & VIEW ROUTING
  const renderDashboardView = () => {
    if (userRole === "admin") {
      return (
        <div className="space-y-6">
          <div className="bg-white border border-stone-200 rounded-none p-6 shadow-none flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-xl font-serif font-bold text-stone-900 tracking-tight">Admin Dashboard Panel</h3>
              <p className="text-xs text-stone-500">Configure school entities and manage verified alumni profiles for {currentSchool?.name}.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentTab("manage-alumni")}
                className="bg-[#1C1A17] hover:bg-[#2E2B27] text-white font-mono text-[10px] font-bold uppercase tracking-wider px-4 py-2.5 rounded-none shadow-none transition-colors"
              >
                Manage Queue
              </button>
            </div>
          </div>
          <AdminPanel 
            currentUserId={currentUser.uid}
            schoolId={currentSchoolId!}
            schoolCode={currentSchool?.schoolCode || ""}
            networkName={currentSchool?.name || "School Hub"}
            setNetworkName={() => {}}
            activeSection="manage-alumni"
          />
        </div>
      );
    }

    if (userRole === "alumnus") {
      const isApproved = alumniStatus === "approved";

      return (
        <div className="space-y-6">
          {!isApproved ? (
            <div className="bg-amber-50/40 border border-stone-200 rounded-none p-6 shadow-none space-y-4 max-w-3xl">
              <div className="flex items-start space-x-3 text-amber-900">
                <Loader className="w-5 h-5 shrink-0 mt-0.5 animate-spin" />
                <div className="text-xs space-y-1">
                  <p className="font-serif font-bold text-stone-900">Your Alumnus Registration is Under Review</p>
                  <p className="leading-relaxed text-stone-600">
                    An administrator of {currentSchool?.name} will verify your graduation details shortly. Approved alumni are highlighted in the active directory.
                  </p>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setCurrentTab("profile")}
                  className="bg-[#1C1A17] text-[#FAF7F2] font-mono text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-none"
                >
                  Edit Profile Journey
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white border border-stone-200 rounded-none p-6 shadow-none grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2 border-r last:border-0 border-stone-100 pr-4">
                  <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">Mentorship Status</h4>
                  <div className="flex items-center space-x-2">
                    <span className="text-3xl font-serif font-bold text-stone-900">{pendingRequestsCount}</span>
                    <span className="text-xs text-stone-500">Pending requests</span>
                  </div>
                  <button
                    onClick={() => setCurrentTab("requests")}
                    className="text-[10px] font-mono font-bold text-amber-700 hover:text-amber-950 uppercase tracking-wider underline inline-flex items-center space-x-1"
                  >
                    <span>Go to Inbox</span>
                    <span>&rarr;</span>
                  </button>
                </div>

                <div className="space-y-2 border-r last:border-0 border-stone-100 pr-4">
                  <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">Quick Actions</h4>
                  <p className="text-xs text-stone-500 leading-relaxed">Share internships or career milestones on the board.</p>
                  <button
                    onClick={() => setCurrentTab("opportunities")}
                    className="bg-[#1C1A17] hover:bg-[#2E2B27] text-white font-mono text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-none transition-colors"
                  >
                    Post Opportunity
                  </button>
                </div>

                <div className="space-y-2 pr-4">
                  <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">Public Journey Card</h4>
                  <p className="text-xs text-stone-500 leading-relaxed">Ensure your journey prompts are up to date for student guidance.</p>
                  <button
                    onClick={() => setCurrentTab("profile")}
                    className="text-stone-800 hover:bg-stone-50 border border-stone-200 font-mono text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-none transition-all"
                  >
                    Edit Answers
                  </button>
                </div>
              </div>

              {/* Mentorship Requests Inbox (Embedded Pending tab) */}
              <div className="bg-white border border-stone-200 rounded-none p-6 shadow-none space-y-4">
                <h3 className="font-serif font-bold text-stone-900 text-lg">Awaiting Connections</h3>
                <p className="text-xs text-stone-500">Review requests sent to you and approve them to start dialogue.</p>
                <RequestsView
                  currentUserId={currentUser.uid}
                  currentUserRole="alumnus"
                  schoolId={currentSchoolId!}
                  setCurrentTab={setCurrentTab}
                  setSelectedConversationId={setSelectedConversationId}
                />
              </div>
            </div>
          )}
        </div>
      );
    }

    // STUDENT DASHBOARD VIEW
    const isApproved = membershipStatus === "active";

    return (
      <div className="space-y-6">
        {!isApproved ? (
          <div className="bg-amber-50/40 border border-stone-200 rounded-none p-6 shadow-none space-y-4 max-w-3xl">
            <div className="flex items-start space-x-3 text-amber-900">
              <Loader className="w-5 h-5 shrink-0 mt-0.5 animate-spin" />
              <div className="text-xs space-y-1">
                <p className="font-serif font-bold text-stone-900">Your Student Registration is Under Review</p>
                <p className="leading-relaxed text-stone-600">
                  An administrator of {currentSchool?.name} will verify your student enrollment details shortly. Approved students can access the full alumni directory, request mentorship, and participate in peer groups.
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setCurrentTab("profile")}
                className="bg-[#1C1A17] text-[#FAF7F2] font-mono text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-none hover:bg-[#2E2B27] transition-colors cursor-pointer"
              >
                Edit Profile Journey
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-white border border-stone-200 rounded-none p-6 md:p-8 shadow-none flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center md:text-left">
                <h3 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">Find Your Mentor Path</h3>
                <p className="text-sm text-stone-500 max-w-xl leading-relaxed">
                  Don't navigate career searches alone. Connect 1:1 with approved {currentSchool?.name} alumni who have walked the same path.
                </p>
              </div>
              <button
                onClick={() => setCurrentTab("directory")}
                className="bg-[#1C1A17] hover:bg-[#2E2B27] text-white font-mono text-xs font-semibold uppercase tracking-wider px-5 py-3.5 rounded-none shadow-none transition-colors shrink-0 flex items-center space-x-2 cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>Search Alumni Directory</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-stone-200 pb-2">
                  <h3 className="font-serif font-bold text-stone-900 text-base flex items-center space-x-2">
                    <Briefcase className="w-4 h-4 text-stone-400" />
                    <span>Recent Career Listings</span>
                  </h3>
                  <button onClick={() => setCurrentTab("opportunities")} className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700 hover:text-amber-900 underline">
                    View All
                  </button>
                </div>
                <OpportunityView 
                  currentUserId={currentUser.uid} 
                  currentUserRole="student"
                  currentUserName={currentUser.displayName || "Student"}
                  schoolId={currentSchoolId!}
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-stone-200 pb-2">
                  <h3 className="font-serif font-bold text-stone-900 text-base flex items-center space-x-2">
                    <Megaphone className="w-4 h-4 text-stone-400" />
                    <span>School Announcements</span>
                  </h3>
                  <button onClick={() => setCurrentTab("announcements")} className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-700 hover:text-amber-900 underline">
                    View All
                  </button>
                </div>
                <AnnouncementView 
                  currentUserId={currentUser.uid} 
                  currentUserRole="student"
                  schoolId={currentSchoolId!}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderActiveTabContent = () => {
    // Prevent pending alumnus or student from querying any other tabs
    const isPendingAlumnus = userRole === "alumnus" && alumniStatus !== "approved";
    const isPendingStudent = userRole === "student" && membershipStatus !== "active";
    if ((isPendingAlumnus || isPendingStudent) && currentTab !== "dashboard" && currentTab !== "profile") {
      return renderDashboardView();
    }

    switch (currentTab) {
      case "dashboard":
        return renderDashboardView();
      case "directory":
        return (
          <DirectoryView 
            currentUserId={currentUser.uid}
            currentUserRole={userRole!}
            schoolId={currentSchoolId!}
          />
        );
      case "student-directory":
        return (
          <StudentDirectoryView 
            currentUserId={currentUser.uid}
            currentUserRole={userRole!}
            schoolId={currentSchoolId!}
          />
        );
      case "opportunities":
        return (
          <OpportunityView 
            currentUserId={currentUser.uid}
            currentUserRole={userRole!}
            currentUserName={currentUser.displayName || "Alumni"}
            schoolId={currentSchoolId!}
          />
        );
      case "announcements":
        return (
          <AnnouncementView 
            currentUserId={currentUser.uid}
            currentUserRole={userRole!}
            schoolId={currentSchoolId!}
          />
        );
      case "requests":
        return (
          <RequestsView 
            currentUserId={currentUser.uid}
            currentUserRole={userRole!}
            schoolId={currentSchoolId!}
            setCurrentTab={setCurrentTab}
            setSelectedConversationId={setSelectedConversationId}
          />
        );
      case "messages":
        return (
          <MessagesView 
            currentUserId={currentUser.uid}
            selectedConversationId={selectedConversationId}
            setSelectedConversationId={setSelectedConversationId}
            schoolId={currentSchoolId!}
          />
        );
      case "profile":
        return (
          <ProfileForm 
            currentUserId={currentUser.uid}
            currentUserRole={userRole!}
            currentUserName={currentUser.displayName || "Anonymous"}
            schoolId={currentSchoolId!}
            onSaveCompleted={() => {
              alert("Your profile has been saved successfully.");
              setCurrentTab("dashboard");
            }}
          />
        );
      case "manage-alumni":
        return (
          <AdminPanel 
            currentUserId={currentUser.uid}
            schoolId={currentSchoolId!}
            schoolCode={currentSchool?.schoolCode || ""}
            networkName={currentSchool?.name || "School Hub"}
            setNetworkName={() => {}}
            activeSection="manage-alumni"
          />
        );
      case "settings":
        return (
          <AdminPanel 
            currentUserId={currentUser.uid}
            schoolId={currentSchoolId!}
            schoolCode={currentSchool?.schoolCode || ""}
            networkName={currentSchool?.name || "School Hub"}
            setNetworkName={() => {}}
            activeSection="settings"
          />
        );
      default:
        return renderDashboardView();
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[#FCFAF6] flex flex-col lg:flex-row">
        <Sidebar 
          role={userRole!}
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          networkName={currentSchool?.name || "AlumniConnect"}
          userName={currentUser?.displayName || "Member"}
          userPhoto={currentUser?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentUser?.displayName || "M")}`}
          onLogout={handleLogout}
          pendingRequestsCount={pendingRequestsCount}
          onSwitchNetwork={mySchools.length > 1 ? () => setCurrentSchoolId(null) : undefined}
          alumniStatus={alumniStatus}
        />

        <main className="flex-1 min-w-0 p-4 md:p-8 lg:p-10 pt-20 lg:pt-10 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {renderActiveTabContent()}
          </div>
        </main>
      </div>
      <Analytics />
    </>
  );
}
