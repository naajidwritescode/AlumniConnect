import React, { useState, useEffect, useRef } from "react";
import { 
  Send, 
  MessageSquare, 
  User, 
  Loader, 
  Clock, 
  AlertCircle,
  ArrowLeft 
} from "lucide-react";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  setDoc,
  updateDoc,
  doc, 
  getDoc, 
  Timestamp 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { ConversationDoc, MessageDoc, UserDoc } from "../types";

interface MessagesViewProps {
  currentUserId: string;
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;
  schoolId: string;
}

interface ResolvedConversation {
  id: string;
  conv: ConversationDoc;
  otherUser?: UserDoc;
}

export default function MessagesView({ 
  currentUserId, 
  selectedConversationId,
  setSelectedConversationId,
  schoolId
}: MessagesViewProps) {
  const [conversations, setConversations] = useState<ResolvedConversation[]>([]);
  const [messages, setMessages] = useState<MessageDoc[]>([]);
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Listen to all conversations for current user
  useEffect(() => {
    if (!schoolId) return;

    setLoadingConv(true);

    const q = query(
      collection(db, "conversations"),
      where("participantIds", "array-contains", currentUserId)
    );

    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        try {
          const list: ResolvedConversation[] = [];
          for (const docSnap of snapshot.docs) {
            const data = docSnap.data() as ConversationDoc;
            
            // Client-side scope to the current school network
            if ((data as any).schoolId !== schoolId) {
              continue;
            }

            const otherUid = data.participantIds.find(id => id !== currentUserId) || "";
            
            const resolved: ResolvedConversation = {
              id: docSnap.id,
              conv: data
            };

            if (otherUid) {
              const userSnap = await getDoc(doc(db, "users", otherUid));
              if (userSnap.exists()) {
                resolved.otherUser = userSnap.data() as UserDoc;
              }
            }
            list.push(resolved);
          }

          // Sort conversations by lastMessageAt desc
          list.sort((a, b) => {
            const aTime = a.conv.lastMessageAt?.toDate()?.getTime() || 0;
            const bTime = b.conv.lastMessageAt?.toDate()?.getTime() || 0;
            return bTime - aTime;
          });

          setConversations(list);
          setLoadingConv(false);
        } catch (error) {
          console.error("Error loading conversations:", error);
          setLoadingConv(false);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "conversations");
      }
    );

    return () => unsub();
  }, [currentUserId, schoolId]);

  // 2. Listen to messages when a conversation is selected
  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    setLoadingMsgs(true);
    const msgsRef = collection(db, "conversations", selectedConversationId, "messages");
    const q = query(msgsRef, orderBy("sentAt", "asc"));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: MessageDoc[] = [];
        snapshot.forEach((doc) => {
          list.push({
            ...(doc.data() as MessageDoc),
            messageId: doc.id
          });
        });
        setMessages(list);
        setLoadingMsgs(false);
        // Scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `conversations/${selectedConversationId}/messages`);
      }
    );

    return () => unsub();
  }, [selectedConversationId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversationId || !inputText.trim() || sending) return;

    if (inputText.trim().length > 2000) {
      alert("Message must be 2000 characters or fewer.");
      return;
    }

    const textToSend = inputText.trim();
    setInputText("");
    setSending(true);

    try {
      const msgId = `msg_${Date.now()}`;
      const msgPayload: MessageDoc = {
        senderId: currentUserId,
        text: textToSend,
        sentAt: Timestamp.now()
      };

      // Create message document in subcollection
      await setDoc(doc(db, "conversations", selectedConversationId, "messages", msgId), msgPayload);

      // Update parent conversation's lastMessageAt
      await updateDoc(doc(db, "conversations", selectedConversationId), {
        lastMessageAt: Timestamp.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `conversations/${selectedConversationId}/messages`);
    } finally {
      setSending(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }
  };

  const activeConv = conversations.find(c => c.id === selectedConversationId);

  return (
    <div className="bg-white border border-stone-200 rounded-none overflow-hidden h-[calc(100vh-8rem)] min-h-[450px] shadow-none flex">
      {/* Sidebar - list of conversations */}
      <div className={`
        w-full md:w-80 border-r border-stone-200 flex flex-col shrink-0 bg-stone-50
        ${selectedConversationId ? "hidden md:flex" : "flex"}
      `}>
        <div className="p-4 border-b border-stone-200 bg-white">
          <h3 className="font-serif font-bold text-stone-900 text-base">Mentorship Chats</h3>
          <p className="text-xs text-stone-500">Select an active connection to message.</p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
          {loadingConv ? (
            <div className="p-8 text-center">
              <Loader className="w-6 h-6 text-stone-300 animate-spin mx-auto" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-stone-400 space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto opacity-50 text-stone-300" />
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-stone-600">No active chats yet.</p>
              <p className="text-[10px] leading-snug font-sans text-stone-400">Chat opens automatically when a mentorship request is accepted.</p>
            </div>
          ) : (
            conversations.map((c) => {
              const isSelected = c.id === selectedConversationId;
              const other = c.otherUser;

              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedConversationId(c.id)}
                  className={`
                    w-full p-4 text-left flex items-center space-x-3 transition-colors hover:bg-stone-50 cursor-pointer
                    ${isSelected ? "bg-stone-100 border-r-2 border-r-amber-600" : ""}
                  `}
                >
                  <img
                    src={other?.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60"}
                    alt={other?.displayName}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-none object-cover border border-stone-200 bg-white"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-serif font-bold text-stone-900 truncate">
                        {other?.displayName || "Loading..."}
                      </span>
                      <span className="text-[10px] font-mono text-stone-400 shrink-0 uppercase tracking-wider">
                        {c.conv.lastMessageAt?.toDate()?.toLocaleDateString([], {month: 'short', day: 'numeric'})}
                      </span>
                    </div>
                    <p className="text-[10px] text-stone-500 font-mono tracking-wider truncate uppercase">
                      {other?.role}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Message Chat Room Panel */}
      <div className={`
        flex-1 flex flex-col justify-between bg-[#FCFAF6]
        ${!selectedConversationId ? "hidden md:flex items-center justify-center" : "flex"}
      `}>
        {selectedConversationId && activeConv ? (
          <>
            {/* Header */}
            <div className="bg-white border-b border-stone-200 p-4 flex items-center space-x-3 shrink-0">
              <button
                onClick={() => setSelectedConversationId(null)}
                className="md:hidden p-1 text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded-none cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <img
                src={activeConv.otherUser?.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60"}
                alt={activeConv.otherUser?.displayName}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-none object-cover border border-stone-200"
              />
              <div>
                <h4 className="font-serif font-bold text-stone-900 text-sm leading-tight">
                  {activeConv.otherUser?.displayName}
                </h4>
                <p className="text-[10px] font-mono text-stone-400 uppercase tracking-wider">{activeConv.otherUser?.role}</p>
              </div>
            </div>

            {/* Scrollable messages container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/10">
              {loadingMsgs ? (
                <div className="flex justify-center items-center py-10">
                  <Loader className="w-6 h-6 text-stone-300 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-10 text-stone-400 font-sans text-xs">
                  <p>No messages yet. Send a greeting to start the journey!</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isSelf = m.senderId === currentUserId;
                  const timeStr = m.sentAt?.toDate()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={m.messageId}
                      className={`flex ${isSelf ? "justify-end" : "justify-start"} items-end space-x-2`}
                    >
                      <div className={`
                        max-w-[70%] rounded-none px-4 py-2.5 text-sm leading-relaxed shadow-none border
                        ${isSelf 
                          ? "bg-[#1C1A17] text-[#FAF7F2] border-[#1C1A17]" 
                          : "bg-white text-stone-900 border-stone-200"
                        }
                      `}>
                        <p className="whitespace-pre-wrap font-sans">{m.text}</p>
                        <div className={`text-[8px] font-mono tracking-wider mt-1 text-right uppercase ${isSelf ? "text-stone-300" : "text-stone-400"}`}>
                          {timeStr || ""}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input field footer */}
            <form onSubmit={handleSendMessage} className="bg-white border-t border-stone-200 p-4 shrink-0 flex items-center space-x-2">
              <input
                type="text"
                required
                maxLength={2000}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-stone-50 text-stone-900 text-sm rounded-none px-4 py-3 border border-stone-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
              <button
                type="submit"
                disabled={sending || !inputText.trim()}
                className="bg-[#1C1A17] hover:bg-[#2E2B27] disabled:opacity-40 text-white rounded-none p-3 shadow-none transition-colors shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4 text-amber-500" />
              </button>
            </form>
          </>
        ) : (
          <div className="text-center p-8 space-y-3">
            <MessageSquare className="w-12 h-12 text-stone-300 mx-auto" />
            <h4 className="font-serif font-bold text-stone-900 text-base">Select a Connection</h4>
            <p className="text-stone-500 text-sm max-w-xs mx-auto font-sans">
              Select an alumni connection from the left pane to begin a high-impact, professional chat.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
