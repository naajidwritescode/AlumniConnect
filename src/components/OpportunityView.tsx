import React, { useState, useEffect } from "react";
import { 
  Briefcase, 
  Plus, 
  ExternalLink, 
  Calendar, 
  Trash2, 
  Edit, 
  X, 
  Clock, 
  Tag, 
  Search,
  Loader,
  AlertCircle
} from "lucide-react";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc, 
  Timestamp,
  getDoc,
  where
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { OpportunityDoc, UserRole, UserDoc } from "../types";

interface OpportunityViewProps {
  currentUserId: string;
  currentUserRole: UserRole;
  currentUserName: string;
  schoolId: string;
}

export default function OpportunityView({ 
  currentUserId, 
  currentUserRole,
  currentUserName,
  schoolId
}: OpportunityViewProps) {
  const [opportunities, setOpportunities] = useState<OpportunityDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Create/Edit Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"internship" | "scholarship" | "competition" | "workshop" | "job">("internship");
  const [description, setDescription] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [deadlineStr, setDeadlineStr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);

    // Listen to opportunities collection for this school
    const q = query(
      collection(db, "opportunities"), 
      where("schoolId", "==", schoolId),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        try {
          const list: OpportunityDoc[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as OpportunityDoc;
            list.push({
              ...data,
              opportunityId: docSnap.id
            });
          });

          // Pre-resolve creator names for better display
          const resolvedPromises = list.map(async (opp) => {
            if (opp.postedByName) return opp;
            try {
              const uSnap = await getDoc(doc(db, "users", opp.postedBy));
              if (uSnap.exists()) {
                const uData = uSnap.data() as UserDoc;
                return { ...opp, postedByName: uData.displayName };
              }
            } catch (err) {
              console.error("Error resolving poster name:", err);
            }
            return { ...opp, postedByName: "Alumnus" };
          });

          const resolvedList = await Promise.all(resolvedPromises);
          setOpportunities(resolvedList);
          setLoading(false);
        } catch (error) {
          console.error("Error reading opportunities:", error);
          setLoading(false);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "opportunities");
      }
    );

    return () => unsub();
  }, [schoolId]);

  const openCreateForm = () => {
    setFormMode("create");
    setEditingId(null);
    setTitle("");
    setType("internship");
    setDescription("");
    setExternalLink("");
    setDeadlineStr("");
    setIsFormOpen(true);
  };

  const openEditForm = (opp: OpportunityDoc) => {
    setFormMode("edit");
    setEditingId(opp.opportunityId || null);
    setTitle(opp.title);
    setType(opp.type);
    setDescription(opp.description);
    setExternalLink(opp.externalLink);
    if (opp.deadline) {
      const date = opp.deadline.toDate();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      setDeadlineStr(`${year}-${month}-${day}`);
    } else {
      setDeadlineStr("");
    }
    setIsFormOpen(true);
  };

  const handleSaveOpportunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !schoolId) return;

    if (title.trim().length > 150) {
      alert("Title must be 150 characters or fewer.");
      return;
    }
    if (description.trim().length > 2000) {
      alert("Description must be 2000 characters or fewer.");
      return;
    }
    if (externalLink.trim().length > 500) {
      alert("External Link must be 500 characters or fewer.");
      return;
    }

    setSaving(true);
    try {
      const oppId = formMode === "create" ? `opp_${Date.now()}` : editingId!;
      const payload: any = {
        schoolId,
        postedBy: formMode === "create" ? currentUserId : opportunities.find(o => o.opportunityId === editingId)?.postedBy || currentUserId,
        postedByName: currentUserName,
        type,
        title: title.trim(),
        description: description.trim(),
        externalLink: externalLink.trim(),
        deadline: deadlineStr ? Timestamp.fromDate(new Date(deadlineStr)) : null,
        createdAt: formMode === "create" ? Timestamp.now() : opportunities.find(o => o.opportunityId === editingId)?.createdAt || Timestamp.now()
      };

      await setDoc(doc(db, "opportunities", oppId), payload);
      setIsFormOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "opportunities");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOpportunity = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this opportunity?")) return;
    try {
      await deleteDoc(doc(db, "opportunities", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `opportunities/${id}`);
    }
  };

  // Filters logic
  const filteredOpportunities = opportunities.filter((opp) => {
    const matchesType = !typeFilter || opp.type === typeFilter;
    const matchesSearch = 
      !searchQuery || 
      opp.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      opp.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getBadgeColor = (type: string) => {
    switch (type) {
      case "internship": return "bg-blue-50/50 text-blue-900 border-blue-200";
      case "job": return "bg-emerald-50/50 text-emerald-900 border-emerald-200";
      case "scholarship": return "bg-purple-50/50 text-purple-900 border-purple-200";
      case "workshop": return "bg-amber-50/50 text-amber-900 border-amber-200";
      default: return "bg-stone-100 text-stone-700 border-stone-200";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">Opportunity Board</h2>
          <p className="text-sm text-stone-500">Explore internships, scholarships, workshops, and job openings posted directly by our alumni network.</p>
        </div>
        {/* Posting permission to Alumnus and Admin */}
        {(currentUserRole === "alumnus" || currentUserRole === "admin") && (
          <button
            onClick={openCreateForm}
            id="btn-post-opportunity"
            className="bg-[#1C1A17] hover:bg-[#2E2B27] text-white font-mono text-[10px] font-bold uppercase tracking-wider px-4 py-3 rounded-none shadow-none transition-all flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-500" />
            <span>Post Opportunity</span>
          </button>
        )}
      </div>

      {/* Filter Row */}
      <div className="bg-white border border-stone-200 rounded-none p-4 shadow-none flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3.5" />
          <input
            type="text"
            placeholder="Search opportunities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-50 text-stone-900 text-sm rounded-none pl-9 pr-4 py-2 border border-stone-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {["", "internship", "scholarship", "competition", "workshop", "job"].map((category) => (
            <button
              key={category}
              onClick={() => setTypeFilter(category)}
              className={`
                px-3 py-1.5 rounded-none text-[10px] font-mono font-bold border transition-all capitalize uppercase tracking-wider cursor-pointer
                ${typeFilter === category 
                  ? "bg-[#1C1A17] border-[#1C1A17] text-white" 
                  : "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                }
              `}
            >
              {category === "" ? "All Categories" : category}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader className="w-8 h-8 text-stone-300 animate-spin" />
        </div>
      ) : filteredOpportunities.length === 0 ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-none p-12 text-center">
          <AlertCircle className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-800 font-serif font-bold text-base">No opportunities listed in this category yet.</p>
          {(searchQuery || typeFilter) && (
            <button
              onClick={() => {
                setSearchQuery("");
                setTypeFilter("");
              }}
              className="mt-3 px-4 py-2 border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 rounded-none text-[10px] font-mono font-bold uppercase tracking-wider cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredOpportunities.map((opp) => {
            const isOwner = opp.postedBy === currentUserId;
            const canModify = isOwner || currentUserRole === "admin";
            const isDeadlinePassed = opp.deadline && opp.deadline.toDate() < new Date();

            return (
              <div
                key={opp.opportunityId}
                className="bg-white border border-stone-200 rounded-none p-6 shadow-none flex flex-col justify-between hover:border-stone-400 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-3">
                    <span className={`px-2.5 py-0.5 rounded-none text-[9px] font-mono font-bold border capitalize tracking-wider uppercase ${getBadgeColor(opp.type)}`}>
                      {opp.type}
                    </span>
                    {canModify && (
                      <div className="flex space-x-1">
                        {isOwner && (
                          <button
                            onClick={() => openEditForm(opp)}
                            className="p-1 text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded transition-colors cursor-pointer"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteOpportunity(opp.opportunityId!)}
                          className="p-1 text-stone-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-serif font-bold text-lg text-stone-900 line-clamp-1 leading-snug">{opp.title}</h4>
                    <p className="text-xs text-stone-400 font-sans mt-0.5">
                      Posted by <span className="text-stone-600 font-bold">{opp.postedByName || "Alumnus"}</span>
                    </p>
                  </div>

                  <p className="text-stone-600 text-sm leading-relaxed whitespace-pre-wrap line-clamp-4 font-sans">
                    {opp.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
                    <Calendar className="w-4 h-4 text-stone-400 shrink-0" />
                    {opp.deadline ? (
                      <span className={isDeadlinePassed ? "text-red-700" : ""}>
                        Deadline: {opp.deadline.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        {isDeadlinePassed && " (Passed)"}
                      </span>
                    ) : (
                      <span>No fixed deadline</span>
                    )}
                  </div>

                  <a
                    href={opp.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#1C1A17] hover:bg-[#2E2B27] text-white font-mono font-bold text-[10px] uppercase tracking-wider px-3.5 py-2.5 rounded-none transition-colors flex items-center space-x-1.5 shadow-none"
                  >
                    <span>Apply</span>
                    <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal Form */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/65 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-none max-w-lg w-full border border-stone-200 p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-stone-100 pb-3">
              <h4 className="text-lg font-serif font-bold text-stone-900">
                {formMode === "create" ? "Post New Opportunity" : "Edit Opportunity"}
              </h4>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOpportunity} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                  Opportunity Title
                </label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  placeholder="e.g. Google Software Engineering Summer Intern"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                    Category
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full text-stone-800 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-mono"
                  >
                    <option value="internship">Internship</option>
                    <option value="scholarship">Scholarship</option>
                    <option value="competition">Competition</option>
                    <option value="workshop">Workshop</option>
                    <option value="job">Full-time Job</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                    Application Deadline (Optional)
                  </label>
                  <input
                    type="date"
                    value={deadlineStr}
                    onChange={(e) => setDeadlineStr(e.target.value)}
                    className="w-full text-stone-800 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  required
                  maxLength={2000}
                  rows={4}
                  placeholder="Provide structured details of what this opportunity entails, requirements, and how candidates can apply..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none p-3 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
                />
                <span className="block text-right text-[10px] font-mono text-stone-400">{description.length}/2000 characters</span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                  External Application Link URL
                </label>
                <input
                  type="url"
                  required
                  maxLength={500}
                  placeholder="https://careers.example.com/apply/123"
                  value={externalLink}
                  onChange={(e) => setExternalLink(e.target.value)}
                  className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-stone-200 text-stone-600 rounded-none text-xs font-mono font-bold uppercase tracking-wider hover:bg-stone-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-[#1C1A17] hover:bg-[#2E2B27] text-white font-mono text-xs uppercase tracking-wider px-4 py-2.5 rounded-none shadow-none disabled:opacity-50 inline-flex items-center space-x-1 cursor-pointer"
                >
                  {saving ? "Saving..." : "Save Post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
