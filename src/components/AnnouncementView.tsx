import React, { useState, useEffect } from "react";
import { 
  Megaphone, 
  Plus, 
  Calendar, 
  MapPin, 
  Trash2, 
  Edit, 
  X, 
  Clock, 
  Loader,
  AlertCircle
} from "lucide-react";
import { 
  collection, 
  query, 
  orderBy, 
  where,
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc, 
  Timestamp 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { AnnouncementDoc } from "../types";

interface AnnouncementViewProps {
  currentUserId: string;
  currentUserRole: "student" | "alumnus" | "admin";
  schoolId: string;
}

export default function AnnouncementView({ 
  currentUserId, 
  currentUserRole,
  schoolId
}: AnnouncementViewProps) {
  const [announcements, setAnnouncements] = useState<AnnouncementDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDateStr, setEventDateStr] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);

    const q = query(
      collection(db, "announcements"), 
      where("schoolId", "==", schoolId),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: AnnouncementDoc[] = [];
        snapshot.forEach((doc) => {
          list.push({
            ...(doc.data() as AnnouncementDoc),
            announcementId: doc.id
          });
        });
        setAnnouncements(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "announcements");
      }
    );

    return () => unsub();
  }, [schoolId]);

  const openCreateForm = () => {
    setFormMode("create");
    setEditingId(null);
    setTitle("");
    setDescription("");
    setEventDateStr("");
    setLocation("");
    setIsFormOpen(true);
  };

  const openEditForm = (ann: AnnouncementDoc) => {
    setFormMode("edit");
    setEditingId(ann.announcementId || null);
    setTitle(ann.title);
    setDescription(ann.description);
    setLocation(ann.location);
    if (ann.eventDate) {
      // Format to datetime-local input (YYYY-MM-DDTHH:MM)
      const date = ann.eventDate.toDate();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      setEventDateStr(`${year}-${month}-${day}T${hours}:${minutes}`);
    } else {
      setEventDateStr("");
    }
    setIsFormOpen(true);
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
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
    if (location.trim().length > 250) {
      alert("Location must be 250 characters or fewer.");
      return;
    }

    setSaving(true);
    try {
      const annId = formMode === "create" ? `ann_${Date.now()}` : editingId!;
      const payload: AnnouncementDoc = {
        postedBy: currentUserId,
        title: title.trim(),
        description: description.trim(),
        eventDate: eventDateStr ? Timestamp.fromDate(new Date(eventDateStr)) : null,
        location: location.trim() || "",
        createdAt: formMode === "create" ? Timestamp.now() : announcements.find(a => a.announcementId === editingId)?.createdAt || Timestamp.now(),
        schoolId: schoolId
      } as any;

      await setDoc(doc(db, "announcements", annId), payload);
      setIsFormOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "announcements");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this announcement?")) return;
    try {
      await deleteDoc(doc(db, "announcements", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `announcements/${id}`);
    }
  };

  // Sort logic: Upcoming event date (future timestamp) first, then by createdAt desc.
  const sortedAnnouncements = [...announcements].sort((a, b) => {
    const now = new Date();
    const aUpcoming = a.eventDate && a.eventDate.toDate() > now;
    const bUpcoming = b.eventDate && b.eventDate.toDate() > now;

    if (aUpcoming && !bUpcoming) return -1;
    if (!aUpcoming && bUpcoming) return 1;

    // If both upcoming or both not upcoming, sort by createdAt desc
    const aTime = a.createdAt?.toDate()?.getTime() || 0;
    const bTime = b.createdAt?.toDate()?.getTime() || 0;
    return bTime - aTime;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-stone-900 tracking-tight">Announcements Feed</h2>
          <p className="text-sm text-stone-500">Official bulletins, webinars, and homecoming dates from your network administrator.</p>
        </div>
        {currentUserRole === "admin" && (
          <button
            onClick={openCreateForm}
            id="btn-post-announcement"
            className="bg-[#1C1A17] hover:bg-[#2E2B27] text-white font-mono text-[10px] font-bold uppercase tracking-wider px-4 py-3 rounded-none shadow-none transition-all flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-500" />
            <span>Post Announcement</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader className="w-8 h-8 text-stone-300 animate-spin" />
        </div>
      ) : sortedAnnouncements.length === 0 ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-none p-12 text-center">
          <AlertCircle className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-800 font-serif font-bold text-base">No announcements posted yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedAnnouncements.map((ann) => {
            const hasEvent = !!ann.eventDate;
            const isUpcoming = hasEvent && ann.eventDate.toDate() > new Date();

            return (
              <div
                key={ann.announcementId}
                className={`
                  bg-white rounded-none p-6 shadow-none border transition-all duration-200
                  ${isUpcoming 
                    ? "border-l-4 border-l-amber-600 border-stone-200" 
                    : "border-stone-200"
                  }
                `}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-serif font-bold text-lg text-stone-950 tracking-tight leading-snug">
                        {ann.title}
                      </h4>
                      {isUpcoming && (
                        <span className="bg-amber-50 text-amber-900 border border-amber-200 text-[9px] font-mono font-bold px-2 py-0.5 rounded-none uppercase tracking-wider">
                          Upcoming Event
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">
                      Posted: {ann.createdAt?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>

                  {currentUserRole === "admin" && (
                    <div className="flex space-x-1 shrink-0">
                      <button
                        onClick={() => openEditForm(ann)}
                        className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded transition-colors cursor-pointer"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAnnouncement(ann.announcementId!)}
                        className="p-1.5 text-stone-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-stone-700 text-sm leading-relaxed mt-4 whitespace-pre-wrap font-sans">
                  {ann.description}
                </p>

                {/* Event meta fields */}
                {(ann.eventDate || ann.location) && (
                  <div className="mt-5 pt-4 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-stone-600 font-mono bg-stone-50 p-4 rounded-none border border-stone-200">
                    {ann.eventDate && (
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>
                          <strong>Event Date:</strong> {ann.eventDate.toDate().toLocaleString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    )}
                    {ann.location && (
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-stone-400 shrink-0" />
                        <span className="truncate">
                          <strong>Location:</strong> {ann.location}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Creator Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/65 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-none max-w-lg w-full border border-stone-200 p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-stone-100 pb-3">
              <h4 className="text-lg font-serif font-bold text-stone-900">
                {formMode === "create" ? "Post New Announcement" : "Edit Announcement"}
              </h4>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAnnouncement} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                  Announcement Title
                </label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  placeholder="e.g. Annual Homecoming & Alumni Networking Dinner"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                  Message Description
                </label>
                <textarea
                  required
                  maxLength={2000}
                  rows={4}
                  placeholder="Write the full message details, guidelines, schedule, and application details here..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none p-3 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 font-sans"
                />
                <span className="block text-right text-[10px] font-mono text-stone-400">{description.length}/2000 characters</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                    Event Date & Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={eventDateStr}
                    onChange={(e) => setEventDateStr(e.target.value)}
                    className="w-full text-stone-800 bg-stone-50 border border-stone-200 rounded-none px-3 py-2.5 text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
                    Location / Virtual Link (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={250}
                    placeholder="e.g. Grand Ballroom or Zoom Meeting URL"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full text-stone-900 bg-stone-50 border border-stone-200 rounded-none px-3 py-2 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
                  />
                </div>
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
                  {saving ? "Posting..." : "Save Announcement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
