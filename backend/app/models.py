from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON, Float, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    permissions = Column(JSON, default={})
    users = relationship("User", back_populates="role")

class Branch(Base):
    __tablename__ = "branches"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    address = Column(Text)
    is_active = Column(Boolean, default=True)
    users = relationship("User", back_populates="branch")

class Module(Base):
    __tablename__ = "modules"
    id = Column(Integer, primary_key=True)
    key = Column(String(50), unique=True)
    name = Column(String(100))
    icon = Column(String(50), default="grid")
    is_active = Column(Boolean, default=True)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    email = Column(String(200), unique=True, nullable=False)
    hashed_password = Column(String(500), nullable=False)
    is_active = Column(Boolean, default=True)
    is_superadmin = Column(Boolean, default=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    allowed_modules = Column(JSON, default=[])
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    role = relationship("Role", back_populates="users")
    branch = relationship("Branch", back_populates="users")

class SequenceConfig(Base):
    __tablename__ = "sequence_configs"
    id = Column(Integer, primary_key=True)
    module = Column(String(50), nullable=False)
    prefix = Column(String(20), default="")
    suffix = Column(String(20), default="")
    padding = Column(Integer, default=4)
    current_number = Column(Integer, default=0)

class CustomField(Base):
    __tablename__ = "custom_fields"
    id = Column(Integer, primary_key=True)
    module = Column(String(50), nullable=False)
    field_name = Column(String(100), nullable=False)
    field_label = Column(String(200), nullable=False)
    field_type = Column(String(50), nullable=False)  # text, number, date, selection, boolean
    options = Column(JSON, default=[])  # for selection type
    required = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

class Stage(Base):
    __tablename__ = "stages"
    id = Column(Integer, primary_key=True)
    module = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)
    color = Column(String(20), default="#6366f1")
    sort_order = Column(Integer, default=0)
    is_final_win = Column(Boolean, default=False)
    is_final_lost = Column(Boolean, default=False)

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    email = Column(String(200))
    phone = Column(String(50))
    address = Column(Text)
    custom_data = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id"))
    leads = relationship("Lead", back_populates="customer")

class Lead(Base):
    __tablename__ = "leads"
    id = Column(Integer, primary_key=True)
    reference = Column(String(50), unique=True)
    title = Column(String(300), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    customer_name = Column(String(200))
    email = Column(String(200))
    phone = Column(String(50))
    stage_id = Column(Integer, ForeignKey("stages.id"), nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    expected_revenue = Column(Float, default=0)
    notes = Column(Text)
    custom_data = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"))
    customer = relationship("Customer", back_populates="leads")
    stage = relationship("Stage")
    assignee = relationship("User", foreign_keys=[assigned_to])
    activities = relationship("Activity", back_populates="lead")

class Activity(Base):
    __tablename__ = "activities"
    id = Column(Integer, primary_key=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    activity_type = Column(String(50))  # call, note, follow-up
    description = Column(Text)
    due_date = Column(DateTime(timezone=True), nullable=True)
    done = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    lead = relationship("Lead", back_populates="activities")

class Installation(Base):
    __tablename__ = "installations"
    id = Column(Integer, primary_key=True)
    reference = Column(String(50), unique=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    customer_name = Column(String(200))
    vehicle_number = Column(String(50))
    vehicle_make = Column(String(100))
    vehicle_model = Column(String(100))
    stage_id = Column(Integer, ForeignKey("stages.id"), nullable=True)
    technician_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text)
    custom_data = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"))
    stage = relationship("Stage")
    technician = relationship("User", foreign_keys=[technician_id])
    customer = relationship("Customer")

class ServiceRequest(Base):
    __tablename__ = "service_requests"
    id = Column(Integer, primary_key=True)
    reference = Column(String(50), unique=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    customer_name = Column(String(200))
    vehicle_number = Column(String(50))
    vehicle_make = Column(String(100))
    vehicle_model = Column(String(100))
    problem_description = Column(Text)
    stage_id = Column(Integer, ForeignKey("stages.id"), nullable=True)
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text)
    custom_data = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"))
    stage = relationship("Stage")
    staff = relationship("User", foreign_keys=[staff_id])
    customer = relationship("Customer")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name = Column(String(200))
    action = Column(String(50))  # CREATE, UPDATE, DELETE
    module = Column(String(50))
    record_id = Column(Integer)
    record_ref = Column(String(100))
    changes = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
