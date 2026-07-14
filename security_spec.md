# AlumniConnect Security Specification

## 1. Data Invariants
- A user's profile role (`student`, `alumnus`, `admin`) can only be modified by an admin.
- Alumni profiles are only visible to the public (non-admin, non-self) when `approvalStatus == "approved"`.
- A mentorship request must only be read or written by the sender (student) or the receiver (alumnus).
- A mentorship request's `status` can only be changed by the alumnus.
- Messages in a conversation must only be read/written by the two verified participants.
- Only admins can create, update, or delete announcements or approve alumni profiles.
- Opportunities can be posted by approved alumni, and can only be modified/deleted by the creator or an admin.
- Settings can only be updated/created by an admin, or created by the first setup user if no network settings exist yet.

## 2. The "Dirty Dozen" Payloads (Vulnerability Mitigation Check)
1. **Identity Spoofing in User Profile:** Student A tries to update their user profile role to "admin" or "alumnus".
2. **Unauthorized Alumni Read:** Student B tries to query and read an unapproved alumni profile.
3. **Impersonated Mentorship Request:** Student A tries to create a mentorship request with `studentId` set to Student C's UID.
4. **Alumnus Status Hijacking:** Student A tries to update a pending mentorship request's `status` to "accepted".
5. **Unauthorized Conversation Access:** Student A tries to read messages in a conversation between Student B and Alumnus C.
6. **Malicious Chat injection:** Student A tries to send a message in a conversation they are not a participant of.
7. **Opportunity Hijacking:** Alumnus A tries to update or delete an opportunity posted by Alumnus B.
8. **Malicious Announcement Creation:** Student A tries to post a school announcement.
9. **Junk ID Resource Exhaustion:** Attacker attempts to write a document with a 10KB string as an ID.
10. **Client-side Timestamp Spoofing:** User tries to create a mentorship request with a custom `createdAt` date from last year.
11. **Shadow Fields in Opportunities:** User tries to inject a hidden field `approvedByAdmin: true` in an opportunity.
12. **Network Name Hijacking:** A student tries to rename the network settings.
