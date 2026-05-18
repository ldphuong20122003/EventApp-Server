const User = require("../models/userModel");
const { sendTaskAssignedEmail, sendTaskCommentEmail } = require("./sendEmail");

/**
 * Gửi email cho những user vừa được thêm vào danh sách assignees (không gửi cho người thực hiện thao tác).
 */
async function notifyAssigneesAdded(actorUserId, assigneeIds, task) {
  const actorStr = String(actorUserId);
  const targets = [...new Set((assigneeIds || []).map((id) => String(id)))].filter(
    (id) => id && id !== actorStr,
  );
  if (!targets.length) return;

  let assignerName = "Người giao việc";
  try {
    const actor = await User.findById(actorUserId).select("fullName email");
    assignerName = actor?.fullName?.trim() || actor?.email || assignerName;
  } catch (e) {
    console.error("notifyAssigneesAdded actor lookup:", e.message);
  }

  const taskTitle = (task && task.title) || "Công việc";
  const taskId = String(task._id || task.id || "");

  for (const uid of targets) {
    try {
      const u = await User.findById(uid).select("email");
      if (!u?.email) continue;
      await sendTaskAssignedEmail(u.email, { taskTitle, assignerName, taskId });
    } catch (e) {
      console.error("notifyAssigneesAdded send:", uid, e.message);
    }
  }
}

/**
 * Thông báo người chủ task và các assignee (trừ người vừa bình luận).
 */
async function notifyTaskCommentRecipients(task, authorUserId, text, hasImage) {
  const authorStr = String(authorUserId);
  const recipients = new Set();
  if (task.owner) recipients.add(String(task.owner));
  for (const a of task.assignees || []) {
    if (a) recipients.add(String(a));
  }
  recipients.delete(authorStr);
  if (!recipients.size) return;

  let authorName = "Thành viên";
  try {
    const author = await User.findById(authorUserId).select("fullName email");
    authorName = author?.fullName?.trim() || author?.email || authorName;
  } catch (e) {
    console.error("notifyTaskCommentRecipients author lookup:", e.message);
  }

  const taskTitle = (task && task.title) || "Công việc";
  const taskId = String(task._id || task.id || "");
  const raw = (text || "").trim();
  const preview =
    raw.length > 280 ? `${raw.slice(0, 280)}…` : raw;

  for (const uid of recipients) {
    try {
      const u = await User.findById(uid).select("email");
      if (!u?.email) continue;
      await sendTaskCommentEmail(u.email, {
        taskTitle,
        authorName,
        preview,
        hasImage: Boolean(hasImage),
        taskId,
      });
    } catch (e) {
      console.error("notifyTaskCommentRecipients send:", uid, e.message);
    }
  }
}

module.exports = { notifyAssigneesAdded, notifyTaskCommentRecipients };
