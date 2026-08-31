from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException, status
from app.models import User, Role
from app.hr_models import HREmployee

def check_permission(user: User, db: Session, module_key: str, menu_path: str = None, action: str = "read") -> bool:
    """
    Evaluates fine-grained permission for a user based on structured role permissions.
    Superadmins always bypass checks.
    """
    if not user or not user.is_active:
        return False
    if user.is_superadmin:
        return True

    # User's primary role or module-specific role
    role = user.role
    if not role and user.role_id:
        role = db.query(Role).filter(Role.id == user.role_id).first()

    # Fallback to module allowed_modules mapping if configured
    allowed_modules = user.allowed_modules or {}
    module_role_id = allowed_modules.get(module_key)
    if module_role_id and (not role or role.id != module_role_id):
        mod_role = db.query(Role).filter(Role.id == module_role_id).first()
        if mod_role:
            role = mod_role

    if not role or not role.permissions:
        return False

    perms = role.permissions

    # Legacy flat permission fallback
    if "modules" not in perms:
        if action == "read" and perms.get("can_read"):
            return True
        if action == "create" and perms.get("can_create"):
            return True
        if action in ("edit", "update") and perms.get("can_edit"):
            return True
        if action == "delete" and perms.get("can_delete"):
            return True
        return False

    # Structured module permission check
    mod_perm = perms.get("modules", {}).get(module_key, {})
    if not mod_perm.get("enabled", True):
        return False

    if not menu_path:
        return True

    menu_perm = mod_perm.get("menus", {}).get(menu_path, {})
    if not menu_perm:
        # Fallback to module default if menu not explicitly listed
        return mod_perm.get("enabled", False)

    return bool(menu_perm.get(action, False))


def get_module_scope(user: User, db: Session, module_key: str) -> str:
    """
    Returns data visibility scope for given module: "own", "team", "branch", or "all".
    """
    if user.is_superadmin:
        return "all"

    role = user.role
    if not role and user.role_id:
        role = db.query(Role).filter(Role.id == user.role_id).first()

    allowed_modules = user.allowed_modules or {}
    module_role_id = allowed_modules.get(module_key)
    if module_role_id and (not role or role.id != module_role_id):
        mod_role = db.query(Role).filter(Role.id == module_role_id).first()
        if mod_role:
            role = mod_role

    if not role or not role.permissions:
        return "own"

    perms = role.permissions

    # Legacy fallback check
    if "modules" not in perms:
        if perms.get("view_own_records_only"):
            return "own"
        if perms.get("view_team_records_only"):
            return "team"
        return "all"

    mod_perm = perms.get("modules", {}).get(module_key, {})
    return mod_perm.get("scope", "all")


def apply_data_scope(query, model, user: User, db: Session, module_key: str, emp_id_attr="employee_id", created_by_attr="created_by", branch_id_attr="branch_id"):
    """
    Applies SQL filters to a SQLAlchemy query according to user's data scope ("own", "team", "branch", "all").
    """
    if user.is_superadmin:
        return query

    scope = get_module_scope(user, db, module_key)
    current_emp = db.query(HREmployee).filter(HREmployee.user_id == user.id).first()

    if scope == "own":
        filters = []
        if hasattr(model, emp_id_attr) and current_emp:
            filters.append(getattr(model, emp_id_attr) == current_emp.id)
        if hasattr(model, created_by_attr):
            filters.append(getattr(model, created_by_attr) == user.id)
        if hasattr(model, "user_id"):
            filters.append(getattr(model, "user_id") == user.id)
        
        if filters:
            return query.filter(or_(*filters))
        return query.filter(False) # No ownership found

    elif scope == "team":
        team_emp_ids = []
        if current_emp:
            team_emp_ids.append(current_emp.id)
            direct_reports = db.query(HREmployee.id).filter(HREmployee.manager_id == current_emp.id).all()
            team_emp_ids.extend([r.id for r in direct_reports])

        filters = []
        if hasattr(model, emp_id_attr) and team_emp_ids:
            filters.append(getattr(model, emp_id_attr).in_(team_emp_ids))
        if hasattr(model, created_by_attr):
            filters.append(getattr(model, created_by_attr) == user.id)

        if filters:
            return query.filter(or_(*filters))
        return query.filter(False)

    elif scope == "branch":
        allowed_branches = set(user.allowed_branches or [])
        if user.branch_id:
            allowed_branches.add(user.branch_id)

        if hasattr(model, branch_id_attr) and allowed_branches:
            return query.filter(getattr(model, branch_id_attr).in_(list(allowed_branches)))
        return query

    # "all" scope
    return query
