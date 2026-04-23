from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, Float, Text, Date
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=True)
    name = Column(String(100))
    email = Column(String(100), unique=True)
    password_hash = Column(String(200))
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    allowed_branches = Column(JSON, default=[])
    allowed_modules = Column(JSON, default={})
    is_active = Column(Boolean, default=True)
    is_superadmin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    role = relationship("Role", back_populates="users")
    branch = relationship("Branch", back_populates="users")
    department = relationship("Department", back_populates="users")

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True)
    permissions = Column(JSON, default={})
    users = relationship("User", back_populates="role")

class Branch(Base):
    __tablename__ = "branches"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True)
    code = Column(String(20), unique=True)
    address = Column(String(200))
    is_active = Column(Boolean, default=True)
    users = relationship("User", back_populates="branch")

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True)
    is_active = Column(Boolean, default=True)
    users = relationship("User", back_populates="department")

class Module(Base):
    __tablename__ = "modules"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True)
    name = Column(String(100))
    icon = Column(String(50))
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)

class Stage(Base):
    __tablename__ = "stages"
    id = Column(Integer, primary_key=True, index=True)
    module = Column(String(50), index=True)
    name = Column(String(50))
    color = Column(String(20), default="#6366f1")
    sort_order = Column(Integer, default=0)
    is_final_win = Column(Boolean, default=False)
    is_final_lost = Column(Boolean, default=False)
    leads = relationship("Lead", back_populates="stage")

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    email = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class CRMTab(Base):
    __tablename__ = "crm_tabs"
    id = Column(Integer, primary_key=True, index=True)
    module = Column(String(50), index=True, default="crm")
    name = Column(String(100))
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    visibility_stages = Column(JSON, default=[]) # List of stage IDs where this tab is visible
    fields = relationship("CRMField", back_populates="tab", cascade="all, delete-orphan", order_by="CRMField.sort_order")

class CRMField(Base):
    __tablename__ = "crm_fields"
    id = Column(Integer, primary_key=True, index=True)
    tab_id = Column(Integer, ForeignKey("crm_tabs.id"), nullable=True)
    module = Column(String(50), index=True, default="crm")
    field_name = Column(String(100), index=True)
    field_label = Column(String(100))
    field_type = Column(String(50))
    placeholder = Column(String(200), nullable=True)
    options = Column(JSON, default=[])
    required = Column(Boolean, default=False)
    width = Column(String(20), default="full")
    visibility_rule = Column(JSON, nullable=True)
    form_template_id = Column(Integer, nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    tab = relationship("CRMTab", back_populates="fields")

class CRMStageRule(Base):
    __tablename__ = "crm_stage_rules"
    id = Column(Integer, primary_key=True, index=True)
    field_name = Column(String(100))
    stage_id = Column(Integer, ForeignKey("stages.id"))
    condition_operator = Column(String(20), default="has_value")
    condition_value = Column(String(100), nullable=True)
    stage = relationship("Stage")

class Lead(Base):
    __tablename__ = "leads"
    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(50), unique=True)
    title = Column(String(200), index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    customer_name = Column(String(100), nullable=True, index=True)
    email = Column(String(100), nullable=True, index=True)
    phone = Column(String(50), nullable=True, index=True)
    stage_id = Column(Integer, ForeignKey("stages.id"))
    assigned_to = Column(Integer, ForeignKey("users.id"))
    expected_revenue = Column(Float, default=0)
    notes = Column(Text, nullable=True)
    custom_data = Column(JSON, default={})
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    stage = relationship("Stage", back_populates="leads")
    assignee = relationship("User", foreign_keys=[assigned_to])
    activities = relationship("Activity", back_populates="lead", cascade="all, delete-orphan")

class Activity(Base):
    __tablename__ = "activities"
    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    installation_id = Column(Integer, ForeignKey("installations.id"), nullable=True)
    activity_type = Column(String(50))
    description = Column(Text)
    due_date = Column(DateTime, nullable=True)
    done = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    lead = relationship("Lead", back_populates="activities")
    installation = relationship("Installation", back_populates="activities")

class CRMActivityType(Base):
    __tablename__ = "crm_activity_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True)
    color = Column(String(20), default="#6366f1")
    icon = Column(String(20), default="📝")
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

class CustomField(Base):
    __tablename__ = "custom_fields"
    id = Column(Integer, primary_key=True, index=True)
    module = Column(String(50), index=True)
    field_name = Column(String(50))
    field_label = Column(String(100))
    field_type = Column(String(20))
    options = Column(JSON, default=[])
    required = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)

class SequenceConfig(Base):
    __tablename__ = "sequences"
    id = Column(Integer, primary_key=True, index=True)
    module = Column(String(50), unique=True)
    prefix = Column(String(20), nullable=True)
    suffix = Column(String(20), nullable=True)
    padding = Column(Integer, default=4)
    current_number = Column(Integer, default=0)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name = Column(String(100), nullable=True)
    action = Column(String(20))
    module = Column(String(50))
    record_id = Column(Integer, nullable=True)
    record_ref = Column(String(50), nullable=True)
    changes = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User")

class ProductCategory(Base):
    __tablename__ = "product_categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class TaxConfig(Base):
    __tablename__ = "tax_configs"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True)
    rate = Column(Float, default=0.0)  # percentage
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class BOM(Base):
    __tablename__ = "boms"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    description = Column(Text, nullable=True)
    warranty_period = Column(Integer, default=0)
    warranty_unit = Column(String(20), default="months")
    created_at = Column(DateTime, default=datetime.utcnow)
    components = relationship("BOMComponent", back_populates="bom", cascade="all, delete-orphan")

class Component(Base):
    __tablename__ = "components_master"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), index=True)
    category = Column(String(100), index=True)
    part_number = Column(String(100), unique=True, index=True)
    product_type = Column(String(50)) # e.g. Storable, Service
    sales_price = Column(Float, default=0.0)
    sales_taxes = Column(Float, default=0.0)
    on_hand_qty = Column(Float, default=0.0)
    image_url = Column(String(500), nullable=True)
    custom_data = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

class BOMComponent(Base):
    __tablename__ = "bom_components"
    id = Column(Integer, primary_key=True, index=True)
    bom_id = Column(Integer, ForeignKey("boms.id"))
    component_id = Column(Integer, ForeignKey("components_master.id"), nullable=True)
    name = Column(String(100))
    part_number = Column(String(50), nullable=True)
    quantity = Column(Integer, default=1)
    warranty_period = Column(Integer, default=0)
    warranty_unit = Column(String(20), default="months")
    sort_order = Column(Integer, default=0)
    bom = relationship("BOM", back_populates="components")
    master_component = relationship("Component")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), index=True)
    name = Column(String(100), index=True)
    serial_number = Column(String(50), unique=True)
    bom_id = Column(Integer, ForeignKey("boms.id"), nullable=True)
    stage_id = Column(Integer, ForeignKey("stages.id"), nullable=True)
    warranty_period = Column(Integer, default=0)
    warranty_unit = Column(String(20), default="months")
    warranty_start_date = Column(Date, nullable=True)
    warranty_end_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    custom_data = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    stage = relationship("Stage")
    bom = relationship("BOM")
    component_serials = relationship("ProductComponentSerial", back_populates="product", cascade="all, delete-orphan")

class ProductComponentSerial(Base):
    __tablename__ = "product_component_serials"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    bom_component_id = Column(Integer, ForeignKey("bom_components.id"))
    serial_number = Column(String(50))
    warranty_period = Column(Integer, default=0)
    warranty_unit = Column(String(20), default="months")
    warranty_start_date = Column(Date, nullable=True)
    warranty_end_date = Column(Date, nullable=True)
    product = relationship("Product", back_populates="component_serials")
    bom_component = relationship("BOMComponent")

class Installation(Base):
    __tablename__ = "installations"
    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(50), unique=True)
    customer_name = Column(String(100), index=True)
    vehicle_number = Column(String(50), nullable=True, index=True)
    vehicle_make = Column(String(100), nullable=True)
    vehicle_model = Column(String(100), nullable=True)
    stage_id = Column(Integer, ForeignKey("stages.id"), nullable=True)
    technician_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    schedule_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    custom_data = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    stage = relationship("Stage")
    technician = relationship("User")
    product = relationship("Product")
    activities = relationship("Activity", back_populates="installation", cascade="all, delete-orphan")

class InstallationTab(Base):
    __tablename__ = "installation_tabs"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    visibility_stages = Column(JSON, default=[])
    fields = relationship("InstallationField", back_populates="tab", cascade="all, delete-orphan", order_by="InstallationField.sort_order")

class InstallationField(Base):
    __tablename__ = "installation_fields"
    id = Column(Integer, primary_key=True, index=True)
    tab_id = Column(Integer, ForeignKey("installation_tabs.id"), nullable=True)
    field_name = Column(String(100), index=True)
    field_label = Column(String(100))
    field_type = Column(String(50))
    placeholder = Column(String(200), nullable=True)
    options = Column(JSON, default=[])
    required = Column(Boolean, default=False)
    width = Column(String(20), default="full")
    visibility_rule = Column(JSON, nullable=True)
    form_template_id = Column(Integer, nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    tab = relationship("InstallationTab", back_populates="fields")

class InstallationStageRule(Base):
    __tablename__ = "installation_stage_rules"
    id = Column(Integer, primary_key=True, index=True)
    field_name = Column(String(100))
    stage_id = Column(Integer, ForeignKey("stages.id"))
    condition_operator = Column(String(20), default="has_value")
    condition_value = Column(String(100), nullable=True)
    stage = relationship("Stage")

class ServiceTab(Base):
    __tablename__ = "service_tabs"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    visibility_stages = Column(JSON, default=[])
    fields = relationship("ServiceField", back_populates="tab", cascade="all, delete-orphan", order_by="ServiceField.sort_order")

class ServiceField(Base):
    __tablename__ = "service_fields"
    id = Column(Integer, primary_key=True, index=True)
    tab_id = Column(Integer, ForeignKey("service_tabs.id"), nullable=True)
    field_name = Column(String(100), index=True)
    field_label = Column(String(100))
    field_type = Column(String(50))
    placeholder = Column(String(200), nullable=True)
    options = Column(JSON, default=[])
    required = Column(Boolean, default=False)
    width = Column(String(20), default="full")
    visibility_rule = Column(JSON, nullable=True)
    form_template_id = Column(Integer, nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    tab = relationship("ServiceTab", back_populates="fields")

class ServiceStageRule(Base):
    __tablename__ = "service_stage_rules"
    id = Column(Integer, primary_key=True, index=True)
    field_name = Column(String(100))
    stage_id = Column(Integer, ForeignKey("stages.id"))
    condition_operator = Column(String(20), default="has_value")
    condition_value = Column(String(100), nullable=True)
    stage = relationship("Stage")

class WarrantyTab(Base):
    __tablename__ = "warranty_tabs"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    visibility_stages = Column(JSON, default=[])
    fields = relationship("WarrantyField", back_populates="tab", cascade="all, delete-orphan", order_by="WarrantyField.sort_order")

class WarrantyField(Base):
    __tablename__ = "warranty_fields"
    id = Column(Integer, primary_key=True, index=True)
    tab_id = Column(Integer, ForeignKey("warranty_tabs.id"), nullable=True)
    field_name = Column(String(100), index=True)
    field_label = Column(String(100))
    field_type = Column(String(50))
    placeholder = Column(String(200), nullable=True)
    options = Column(JSON, default=[])
    required = Column(Boolean, default=False)
    width = Column(String(20), default="full")
    visibility_rule = Column(JSON, nullable=True)
    form_template_id = Column(Integer, nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    tab = relationship("WarrantyTab", back_populates="fields")

class WarrantyStageRule(Base):
    __tablename__ = "warranty_stage_rules"
    id = Column(Integer, primary_key=True, index=True)
    field_name = Column(String(100))
    stage_id = Column(Integer, ForeignKey("stages.id"))
    condition_operator = Column(String(20), default="has_value")
    condition_value = Column(String(100), nullable=True)
    stage = relationship("Stage")

class KonwertCareTab(Base):
    __tablename__ = "konwert_care_tabs"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    visibility_stages = Column(JSON, default=[])
    fields = relationship("KonwertCareField", back_populates="tab", cascade="all, delete-orphan", order_by="KonwertCareField.sort_order")

class KonwertCareField(Base):
    __tablename__ = "konwert_care_fields"
    id = Column(Integer, primary_key=True, index=True)
    tab_id = Column(Integer, ForeignKey("konwert_care_tabs.id"), nullable=True)
    field_name = Column(String(100), index=True)
    field_label = Column(String(100))
    field_type = Column(String(50))
    placeholder = Column(String(200), nullable=True)
    options = Column(JSON, default=[])
    required = Column(Boolean, default=False)
    width = Column(String(20), default="full")
    visibility_rule = Column(JSON, nullable=True)
    form_template_id = Column(Integer, nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    tab = relationship("KonwertCareTab", back_populates="fields")

class KonwertCareStageRule(Base):
    __tablename__ = "konwert_care_stage_rules"
    id = Column(Integer, primary_key=True, index=True)
    field_name = Column(String(100))
    stage_id = Column(Integer, ForeignKey("stages.id"))
    condition_operator = Column(String(20), default="has_value")
    condition_value = Column(String(100), nullable=True)
    stage = relationship("Stage")

class ServiceRequest(Base):
    __tablename__ = "service_requests"
    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(50), unique=True)
    customer_name = Column(String(100), index=True)
    customer_id = Column(Integer, nullable=True)
    vehicle_number = Column(String(50), nullable=True, index=True)
    phone = Column(String(50), nullable=True, index=True)
    contact_name = Column(String(100), nullable=True)
    contact_number = Column(String(50), nullable=True)
    invoice_number = Column(String(100), nullable=True)
    vehicle_year = Column(String(10), nullable=True)
    delivery_date = Column(Date, nullable=True)
    vehicle_make = Column(String(100), nullable=True)
    vehicle_model = Column(String(100), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    problem_description = Column(Text, nullable=True)
    stage_id = Column(Integer, ForeignKey("stages.id"), nullable=True)
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    custom_data = Column(JSON, default={})
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    stage = relationship("Stage")
    staff = relationship("User", foreign_keys=[staff_id])
    product = relationship("Product")

class KonwertCareTicket(Base):
    __tablename__ = "konwert_care_tickets"
    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(50), unique=True)
    customer_name = Column(String(100), index=True)
    phone = Column(String(50), nullable=True, index=True)
    email = Column(String(100), nullable=True, index=True)
    vehicle_number = Column(String(50), nullable=True, index=True)
    product_serial = Column(String(50), nullable=True)
    vehicle_make = Column(String(100), nullable=True)
    vehicle_model = Column(String(100), nullable=True)
    issue_type = Column(String(100), nullable=True)
    issue_description = Column(Text, nullable=True)
    stage_id = Column(Integer, ForeignKey("stages.id"), nullable=True)
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    custom_data = Column(JSON, default={})
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    stage = relationship("Stage")
    staff = relationship("User", foreign_keys=[staff_id])

class FormDefinition(Base):
    __tablename__ = "form_definitions"
    id = Column(Integer, primary_key=True, index=True)
    module = Column(String(50), index=True) # cm, installation, etc.
    name = Column(String(100))
    prefix_template = Column(String(50), default="") # e.g. "FRM-"
    suffix_template = Column(String(50), default="")
    reset_cycle = Column(String(20), default="none") # daily, weekly, monthly, none
    last_number = Column(Integer, default=0)
    last_reset_date = Column(DateTime, nullable=True)
    
    fields_config = Column(JSON, default=[]) # List of fields in THIS form
    mapping_config = Column(JSON, default={}) # { "form_field": "parent_field" }
    pdf_config = Column(JSON, default={}) # { "logo": "...", "header": "...", "footer": "..." }
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class FormSubmission(Base):
    __tablename__ = "form_submissions"
    id = Column(Integer, primary_key=True, index=True)
    form_definition_id = Column(Integer, ForeignKey("form_definitions.id"))
    parent_id = Column(Integer, index=True) # lead_id or installation_id
    reference_number = Column(String(100), unique=True)
    
    data = Column(JSON, default={})
    status = Column(String(20), default="draft") # draft, final
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to user
    author = relationship("User")
    definition = relationship("FormDefinition")
