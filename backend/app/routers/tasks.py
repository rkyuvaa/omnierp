from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, asc
from typing import Optional, List
from datetime import datetime, timedelta
import os, uuid, shutil
from app.database import get_db
from app.models import User, Task, TaskSubtask, TaskComment, TaskAttachment, TaskActivityLog, TaskLabel
from app.hr_models import HRNotification
from app.auth import get_current_user

router = APIRouter()

# ── Status transition rules ──────────────────────────────
STATUS_ORDER = ["todo", "inprogress", "inreview", "done", "closed"]
STATUS_LABELS = {
    "todo": "To Do",
    "inprogress": "In Progress",
    "inreview": "In Review",
    "done": "Done",
    "closed": "Closed"
}

def can_transition(from_status: str, to_status: str) -> bool:
    """Enforce: cannot skip from todo directly to done."""
    if from_status == to_status:
        return True
    from_idx = STATUS_ORDER.index(from_status) if from_status in STATUS_ORDER else 0
    to_idx = STATUS_ORDER.index(to_status) if to_status in STATUS_ORDER else 0
    # Can always go backwards, but cannot skip todo -> done (skip inprogress)
    if from_status == "todo" and to_status == "done":
        return False
    return True

def generate_task_reference(db: Session) -> str:
    count = db.query(Task).count() + 1
    return f"TASK-{str(count).zfill(4)}"

def create_notification(db: Session, user_id: int, title: str, message: str, notif_type: str = "info", ref_id: int = None):
    notif = HRNotification(
        user_id=user_id,
        title=title,
        message=message,
        notif_type=notif_type,
        reference_type="task",
        reference_id=ref_id,
        is_read=False
    )
    db.add(notif)

def log_activity(db: Session, task_id: int, user: User, action: str, field: str = None, old_val: str = None, new_val: str = None, description: str = None):
    log = TaskActivityLog(
        task_id=task_id,
        user_id=user.id,
        user_name=user.name,
        action=action,
        field_changed=field,
        old_value=old_val,
        new_value=new_val,
        description=description or f"{user.name} {action.replace('_', ' ')}"
    )
    db.add(log)

def serialize_task(t: Task, db: Session) -> dict:
    labels = []
    if t.label_ids:
        lbs = db.query(TaskLabel).filter(TaskLabel.id.in_(t.label_ids)).all()
        labels = [{"id": l.id, "name": l.name, "color": l.color} for l in lbs]

    subtasks = [{"id": s.id, "title": s.title, "is_done": s.is_done,
                 "assigned_to": s.assigned_to,
                 "assignee_name": s.assignee.name if s.assignee else None,
                 "due_date": s.due_date.isoformat() if s.due_date else None,
                 "done_at": s.done_at.isoformat() if s.done_at else None
                 } for s in (t.subtasks or [])]

    subtask_total = len(subtasks)
    subtask_done = sum(1 for s in subtasks if s["is_done"])

    return {
        "id": t.id,
        "reference": t.reference,
        "title": t.title,
        "description": t.description,
        "status": t.status,
        "priority": t.priority,
        "due_date": t.due_date.isoformat() if t.due_date else None,
        "assigned_to": t.assigned_to,
        "assignee_name": t.assignee.name if t.assignee else None,
        "assignee_initials": t.assignee.name[0].upper() if t.assignee else None,
        "created_by": t.created_by,
        "creator_name": t.creator.name if t.creator else None,
        "label_ids": t.label_ids or [],
        "labels": labels,
        "is_deleted": t.is_deleted,
        "deleted_at": t.deleted_at.isoformat() if t.deleted_at else None,
        "closed_at": t.closed_at.isoformat() if t.closed_at else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        "subtask_total": subtask_total,
        "subtask_done": subtask_done,
        "is_overdue": bool(t.due_date and t.due_date < datetime.utcnow() and t.status not in ["done", "closed"]),
    }

# ── LABELS ────────────────────────────────────────────────
@router.get("/labels")
def get_labels(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    labels = db.query(TaskLabel).order_by(TaskLabel.name).all()
    return [{"id": l.id, "name": l.name, "color": l.color} for l in labels]

@router.post("/labels")
def create_label(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_superadmin:
        raise HTTPException(403, "Only admin can create labels")
    existing = db.query(TaskLabel).filter(TaskLabel.name == data["name"]).first()
    if existing:
        raise HTTPException(400, "Label name already exists")
    label = TaskLabel(name=data["name"], color=data.get("color", "#6366f1"), created_by=current_user.id)
    db.add(label)
    db.commit()
    db.refresh(label)
    return {"id": label.id, "name": label.name, "color": label.color}

@router.put("/labels/{label_id}")
def update_label(label_id: int, data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_superadmin:
        raise HTTPException(403, "Only admin can update labels")
    label = db.query(TaskLabel).filter(TaskLabel.id == label_id).first()
    if not label:
        raise HTTPException(404, "Label not found")
    if "name" in data:
        label.name = data["name"]
    if "color" in data:
        label.color = data["color"]
    db.commit()
    return {"id": label.id, "name": label.name, "color": label.color}

@router.delete("/labels/{label_id}")
def delete_label(label_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_superadmin:
        raise HTTPException(403, "Only admin can delete labels")
    label = db.query(TaskLabel).filter(TaskLabel.id == label_id).first()
    if not label:
        raise HTTPException(404)
    db.delete(label)
    db.commit()
    return {"ok": True}

# ── TASKS LIST ────────────────────────────────────────────
@router.get("/")
def list_tasks(
    search: str = "",
    status: str = "",
    priority: str = "",
    assigned_to: Optional[int] = None,
    due_from: Optional[str] = None,
    due_to: Optional[str] = None,
    label_id: Optional[int] = None,
    include_closed: bool = False,
    include_deleted: bool = False,
    sort_by: str = "priority_due",
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Task)

    if not include_deleted:
        q = q.filter(Task.is_deleted == False)
    else:
        q = q.filter(Task.is_deleted == True)

    if not include_closed and not include_deleted:
        q = q.filter(Task.status != "closed")

    if search:
        q = q.filter(or_(Task.title.ilike(f"%{search}%"), Task.description.ilike(f"%{search}%")))

    if status:
        statuses = [s.strip() for s in status.split(",") if s.strip()]
        q = q.filter(Task.status.in_(statuses))

    if priority:
        priorities = [p.strip() for p in priority.split(",") if p.strip()]
        q = q.filter(Task.priority.in_(priorities))

    if assigned_to:
        q = q.filter(Task.assigned_to == assigned_to)

    if due_from:
        q = q.filter(Task.due_date >= datetime.fromisoformat(due_from))

    if due_to:
        q = q.filter(Task.due_date <= datetime.fromisoformat(due_to))

    # ── Own-records scope enforcement ─────────────────────────────
    if not current_user.is_superadmin:
        allowed_mods = current_user.allowed_modules or {}
        task_role_id = allowed_mods.get("tasks")
        if task_role_id:
            from app.models import Role as RoleModel
            task_role = db.query(RoleModel).filter(RoleModel.id == task_role_id).first()
            if task_role and (task_role.permissions or {}).get("view_own_records_only"):
                q = q.filter(Task.assigned_to == current_user.id)

    total = q.count()

    # Ordering: urgent > high > medium > low, then by due date
    from sqlalchemy import case, nullslast
    priority_order = case(
        (Task.priority == "urgent", 1),
        (Task.priority == "high", 2),
        (Task.priority == "medium", 3),
        (Task.priority == "low", 4),
        else_=5
    )
    # Overdue tasks pinned first
    now = datetime.utcnow()
    overdue_order = case(
        (and_(Task.due_date < now, ~Task.status.in_(["done", "closed"])), 0),
        else_=1
    )

    if sort_by == "priority_due":
        q = q.order_by(overdue_order, priority_order, nullslast(Task.due_date.asc()))
    elif sort_by == "due_date":
        q = q.order_by(nullslast(Task.due_date.asc()))
    elif sort_by == "created_at":
        q = q.order_by(Task.created_at.desc())
    elif sort_by == "status":
        q = q.order_by(Task.status)
    else:
        q = q.order_by(overdue_order, priority_order, nullslast(Task.due_date.asc()))

    tasks = q.offset((page - 1) * limit).limit(limit).all()
    return {
        "items": [serialize_task(t, db) for t in tasks],
        "total": total,
        "page": page,
    }

# ── DASHBOARD ─────────────────────────────────────────────
@router.get("/dashboard")
def task_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    tomorrow_end = today_end + timedelta(days=1)

    base = db.query(Task).filter(Task.is_deleted == False, Task.status != "closed")
    my_tasks = base.filter(Task.assigned_to == current_user.id)

    return {
        "my_total": my_tasks.count(),
        "my_overdue": my_tasks.filter(Task.due_date < now, ~Task.status.in_(["done", "closed"])).count(),
        "my_due_today": my_tasks.filter(Task.due_date >= today_start, Task.due_date < today_end).count(),
        "my_due_tomorrow": my_tasks.filter(Task.due_date >= today_end, Task.due_date < tomorrow_end).count(),
        "by_status": {
            s: base.filter(Task.status == s).count() for s in ["todo", "inprogress", "inreview", "done"]
        },
        "by_priority": {
            p: my_tasks.filter(Task.priority == p).count() for p in ["low", "medium", "high", "urgent"]
        },
        "upcoming": [serialize_task(t, db) for t in
            my_tasks.filter(Task.status != "done").order_by(Task.due_date.asc()).limit(5).all()
        ],
    }

# ── CALENDAR ENDPOINT ─────────────────────────────────────
@router.get("/calendar")
def task_calendar(
    year: int, month: int,
    assigned_to: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from calendar import monthrange
    _, days_in_month = monthrange(year, month)
    start = datetime(year, month, 1)
    end = datetime(year, month, days_in_month, 23, 59, 59)

    q = db.query(Task).filter(
        Task.is_deleted == False,
        Task.due_date >= start,
        Task.due_date <= end
    )
    if assigned_to:
        q = q.filter(Task.assigned_to == assigned_to)

    tasks = q.all()
    calendar_data = {}
    for t in tasks:
        day = t.due_date.day
        if day not in calendar_data:
            calendar_data[day] = []
        calendar_data[day].append({
            "id": t.id, "title": t.title, "status": t.status, "priority": t.priority,
            "reference": t.reference,
            "is_overdue": t.due_date < datetime.utcnow() and t.status not in ["done", "closed"]
        })
    return {"year": year, "month": month, "days": calendar_data}

# ── CREATE TASK ───────────────────────────────────────────
@router.post("/")
def create_task(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    due = None
    if data.get("due_date"):
        try:
            due = datetime.fromisoformat(data["due_date"].replace("Z", "+00:00").replace("+00:00", ""))
        except:
            pass

    task = Task(
        reference=generate_task_reference(db),
        title=data["title"].strip(),
        description=data.get("description"),
        status="todo",
        priority=data.get("priority", "medium"),
        due_date=due,
        assigned_to=data.get("assigned_to"),
        created_by=current_user.id,
        label_ids=data.get("label_ids", []),
    )
    db.add(task)
    db.flush()

    log_activity(db, task.id, current_user, "created", description=f"{current_user.name} created this task")

    # Notify assignee
    if task.assigned_to and task.assigned_to != current_user.id:
        create_notification(
            db, task.assigned_to,
            "New Task Assigned",
            f"You have been assigned a new task: {task.title}",
            notif_type="info", ref_id=task.id
        )

    db.commit()
    db.refresh(task)
    return serialize_task(task, db)

# ── GET SINGLE TASK ───────────────────────────────────────
@router.get("/{task_id}")
def get_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    data = serialize_task(task, db)

    # Comments
    data["comments"] = [{
        "id": c.id, "text": c.text, "is_edited": c.is_edited,
        "created_by": c.created_by,
        "author_name": c.author.name if c.author else None,
        "author_initials": c.author.name[0].upper() if c.author else "?",
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        "attachments": [{"id": a.id, "filename": a.filename, "file_url": a.file_url, "mime_type": a.mime_type} for a in (c.attachments or [])]
    } for c in (task.comments or [])]

    # Attachments (task-level only)
    data["attachments"] = [{
        "id": a.id, "filename": a.filename, "file_url": a.file_url,
        "file_size": a.file_size, "mime_type": a.mime_type,
        "uploaded_by": a.uploaded_by,
        "uploader_name": a.uploader.name if a.uploader else None,
        "created_at": a.created_at.isoformat() if a.created_at else None
    } for a in (task.attachments or []) if not a.comment_id]

    # Activity log
    data["activity"] = [{
        "id": l.id, "action": l.action, "field_changed": l.field_changed,
        "old_value": l.old_value, "new_value": l.new_value,
        "description": l.description, "user_name": l.user_name,
        "created_at": l.created_at.isoformat() if l.created_at else None
    } for l in (task.activity_logs or [])]

    return data

# ── UPDATE TASK ───────────────────────────────────────────
@router.put("/{task_id}")
def update_task(task_id: int, data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.is_deleted == False).first()
    if not task:
        raise HTTPException(404, "Task not found")
    if task.status == "closed":
        raise HTTPException(400, "Closed tasks cannot be edited")

    changes = []

    if "title" in data and data["title"] != task.title:
        log_activity(db, task.id, current_user, "updated", "title", task.title, data["title"],
                     f"{current_user.name} changed title")
        task.title = data["title"]

    if "description" in data and data["description"] != task.description:
        log_activity(db, task.id, current_user, "updated", "description", None, None,
                     f"{current_user.name} updated the description")
        task.description = data["description"]

    if "priority" in data and data["priority"] != task.priority:
        old_p, new_p = task.priority, data["priority"]
        log_activity(db, task.id, current_user, "priority_changed", "priority", old_p, new_p,
                     f"{current_user.name} changed priority from {old_p} to {new_p}")
        task.priority = new_p

    if "status" in data and data["status"] != task.status:
        new_status = data["status"]
        if not can_transition(task.status, new_status):
            raise HTTPException(400, f"Cannot move task from '{task.status}' to '{new_status}' — must pass through In Progress first")
        old_status = task.status
        log_activity(db, task.id, current_user, "status_changed", "status",
                     STATUS_LABELS.get(old_status, old_status),
                     STATUS_LABELS.get(new_status, new_status),
                     f"{current_user.name} moved task from {STATUS_LABELS.get(old_status)} to {STATUS_LABELS.get(new_status)}")
        task.status = new_status
        if new_status == "closed":
            task.closed_at = datetime.utcnow()
        # Notify on Done
        if new_status == "done":
            for uid in set(filter(None, [task.assigned_to, task.created_by])):
                if uid != current_user.id:
                    create_notification(db, uid, "Task Completed",
                        f"{current_user.name} marked '{task.title}' as Done", "success", task.id)

    if "due_date" in data:
        new_due = None
        if data["due_date"]:
            try:
                new_due = datetime.fromisoformat(data["due_date"].replace("Z", "+00:00").replace("+00:00", ""))
            except:
                pass
        if new_due != task.due_date:
            log_activity(db, task.id, current_user, "updated", "due_date",
                         task.due_date.isoformat() if task.due_date else None,
                         new_due.isoformat() if new_due else None,
                         f"{current_user.name} changed due date")
            task.due_date = new_due

    if "assigned_to" in data and data["assigned_to"] != task.assigned_to:
        old_assignee_id = task.assigned_to
        new_assignee_id = data["assigned_to"]
        task.assigned_to = new_assignee_id
        log_activity(db, task.id, current_user, "assigned", "assigned_to",
                     str(old_assignee_id), str(new_assignee_id),
                     f"{current_user.name} reassigned the task")
        # Notify old assignee
        if old_assignee_id and old_assignee_id != current_user.id:
            create_notification(db, old_assignee_id, "Task Reassigned",
                f"You have been removed from task: {task.title}", "warning", task.id)
        # Notify new assignee
        if new_assignee_id and new_assignee_id != current_user.id:
            create_notification(db, new_assignee_id, "Task Assigned",
                f"You have been assigned: {task.title}", "info", task.id)

    if "label_ids" in data:
        task.label_ids = data["label_ids"]

    task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return serialize_task(task, db)

# ── SOFT DELETE ───────────────────────────────────────────
@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.is_deleted == False).first()
    if not task:
        raise HTTPException(404)
    if not current_user.is_superadmin and task.created_by != current_user.id:
        raise HTTPException(403, "You can only delete tasks you created")
    task.is_deleted = True
    task.deleted_at = datetime.utcnow()
    log_activity(db, task.id, current_user, "deleted", description=f"{current_user.name} deleted this task")
    db.commit()
    return {"ok": True}

# ── RESTORE FROM TRASH ─────────────────────────────────────
@router.post("/{task_id}/restore")
def restore_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_superadmin:
        raise HTTPException(403, "Only admin can restore tasks")
    task = db.query(Task).filter(Task.id == task_id, Task.is_deleted == True).first()
    if not task:
        raise HTTPException(404)
    task.is_deleted = False
    task.deleted_at = None
    task.status = "todo"
    log_activity(db, task.id, current_user, "restored", description=f"{current_user.name} restored this task from trash")
    if task.assigned_to:
        create_notification(db, task.assigned_to, "Task Restored",
            f"'{task.title}' has been restored and reassigned to you", "info", task.id)
    db.commit()
    return serialize_task(task, db)

# ── PERMANENT DELETE ──────────────────────────────────────
@router.delete("/{task_id}/permanent")
def permanent_delete(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_superadmin:
        raise HTTPException(403)
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404)
    db.delete(task)
    db.commit()
    return {"ok": True}

# ── SUBTASKS ──────────────────────────────────────────────
@router.post("/{task_id}/subtasks")
def add_subtask(task_id: int, data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.is_deleted == False).first()
    if not task:
        raise HTTPException(404)
    due = None
    if data.get("due_date"):
        try:
            due = datetime.fromisoformat(data["due_date"].replace("Z", ""))
        except:
            pass
    sub = TaskSubtask(task_id=task_id, title=data["title"], assigned_to=data.get("assigned_to"), due_date=due)
    db.add(sub)
    log_activity(db, task_id, current_user, "subtask_added", description=f"{current_user.name} added subtask: {data['title']}")
    db.commit()
    db.refresh(sub)
    return {"id": sub.id, "title": sub.title, "is_done": sub.is_done, "assigned_to": sub.assigned_to,
            "assignee_name": sub.assignee.name if sub.assignee else None,
            "due_date": sub.due_date.isoformat() if sub.due_date else None}

@router.put("/{task_id}/subtasks/{sub_id}")
def update_subtask(task_id: int, sub_id: int, data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sub = db.query(TaskSubtask).filter(TaskSubtask.id == sub_id, TaskSubtask.task_id == task_id).first()
    if not sub:
        raise HTTPException(404)
    if "title" in data:
        sub.title = data["title"]
    if "is_done" in data:
        was_done = sub.is_done
        sub.is_done = data["is_done"]
        if data["is_done"] and not was_done:
            sub.done_at = datetime.utcnow()
            log_activity(db, task_id, current_user, "subtask_done",
                         description=f"{current_user.name} completed subtask: {sub.title}")
        elif not data["is_done"]:
            sub.done_at = None
    if "assigned_to" in data:
        sub.assigned_to = data["assigned_to"]
    db.commit()
    return {"id": sub.id, "title": sub.title, "is_done": sub.is_done, "assigned_to": sub.assigned_to,
            "assignee_name": sub.assignee.name if sub.assignee else None,
            "due_date": sub.due_date.isoformat() if sub.due_date else None,
            "done_at": sub.done_at.isoformat() if sub.done_at else None}

@router.delete("/{task_id}/subtasks/{sub_id}")
def delete_subtask(task_id: int, sub_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sub = db.query(TaskSubtask).filter(TaskSubtask.id == sub_id, TaskSubtask.task_id == task_id).first()
    if not sub:
        raise HTTPException(404)
    db.delete(sub)
    db.commit()
    return {"ok": True}

# ── COMMENTS ─────────────────────────────────────────────
@router.post("/{task_id}/comments")
def add_comment(task_id: int, data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.is_deleted == False).first()
    if not task:
        raise HTTPException(404)
    if task.status == "closed":
        raise HTTPException(400, "Cannot comment on a closed task")
    comment = TaskComment(task_id=task_id, text=data["text"], created_by=current_user.id)
    db.add(comment)
    db.flush()
    log_activity(db, task_id, current_user, "commented", description=f"{current_user.name} added a comment")
    # Notify assignee and creator (not the commenter)
    notif_ids = set(filter(None, [task.assigned_to, task.created_by])) - {current_user.id}
    for uid in notif_ids:
        create_notification(db, uid, "New Comment",
            f"{current_user.name} commented on: {task.title}", "info", task.id)
    db.commit()
    db.refresh(comment)
    return {
        "id": comment.id, "text": comment.text, "is_edited": False,
        "created_by": comment.created_by,
        "author_name": current_user.name,
        "author_initials": current_user.name[0].upper(),
        "created_at": comment.created_at.isoformat(),
        "updated_at": comment.updated_at.isoformat(),
        "attachments": []
    }

@router.put("/{task_id}/comments/{comment_id}")
def edit_comment(task_id: int, comment_id: int, data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    comment = db.query(TaskComment).filter(TaskComment.id == comment_id, TaskComment.task_id == task_id).first()
    if not comment:
        raise HTTPException(404)
    if comment.created_by != current_user.id and not current_user.is_superadmin:
        raise HTTPException(403, "Can only edit your own comments")
    comment.text = data["text"]
    comment.is_edited = True
    comment.updated_at = datetime.utcnow()
    db.commit()
    return {"id": comment.id, "text": comment.text, "is_edited": True,
            "updated_at": comment.updated_at.isoformat()}

@router.delete("/{task_id}/comments/{comment_id}")
def delete_comment(task_id: int, comment_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    comment = db.query(TaskComment).filter(TaskComment.id == comment_id, TaskComment.task_id == task_id).first()
    if not comment:
        raise HTTPException(404)
    if comment.created_by != current_user.id and not current_user.is_superadmin:
        raise HTTPException(403)
    db.delete(comment)
    db.commit()
    return {"ok": True}

# ── ATTACHMENTS ───────────────────────────────────────────
@router.post("/{task_id}/attachments")
async def upload_attachment(
    task_id: int,
    file: UploadFile = File(...),
    comment_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id, Task.is_deleted == False).first()
    if not task:
        raise HTTPException(404)

    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    upload_dir = os.path.join(BASE_DIR, "static", "uploads", "tasks")
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename)[1]
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(upload_dir, unique_name)

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_size = os.path.getsize(file_path)
    file_url = f"/api/static/uploads/tasks/{unique_name}"

    att = TaskAttachment(
        task_id=task_id,
        comment_id=comment_id,
        filename=file.filename,
        file_url=file_url,
        file_size=file_size,
        mime_type=file.content_type,
        uploaded_by=current_user.id
    )
    db.add(att)
    log_activity(db, task_id, current_user, "attachment_added",
                 description=f"{current_user.name} attached {file.filename}")
    db.commit()
    db.refresh(att)
    return {"id": att.id, "filename": att.filename, "file_url": att.file_url,
            "file_size": att.file_size, "mime_type": att.mime_type}

@router.delete("/{task_id}/attachments/{att_id}")
def delete_attachment(task_id: int, att_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    att = db.query(TaskAttachment).filter(TaskAttachment.id == att_id, TaskAttachment.task_id == task_id).first()
    if not att:
        raise HTTPException(404)
    if att.uploaded_by != current_user.id and not current_user.is_superadmin:
        raise HTTPException(403, "Only the uploader or admin can delete attachments")
    db.delete(att)
    db.commit()
    return {"ok": True}

# ── BULK OPERATIONS ───────────────────────────────────────
@router.post("/bulk")
def bulk_update(data: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task_ids = data.get("task_ids", [])
    if not task_ids:
        raise HTTPException(400, "No task IDs provided")

    tasks = db.query(Task).filter(Task.id.in_(task_ids), Task.is_deleted == False).all()
    updated = 0
    for task in tasks:
        if "priority" in data:
            task.priority = data["priority"]
            log_activity(db, task.id, current_user, "priority_changed",
                         description=f"{current_user.name} bulk-changed priority to {data['priority']}")
        if "status" in data:
            if can_transition(task.status, data["status"]):
                task.status = data["status"]
                log_activity(db, task.id, current_user, "status_changed",
                             description=f"{current_user.name} bulk-changed status to {data['status']}")
        if "assigned_to" in data:
            old = task.assigned_to
            task.assigned_to = data["assigned_to"]
            if data["assigned_to"] and data["assigned_to"] != current_user.id:
                create_notification(db, data["assigned_to"], "Task Assigned",
                    f"You have been assigned: {task.title}", "info", task.id)
        task.updated_at = datetime.utcnow()
        updated += 1

    db.commit()
    return {"updated": updated}
