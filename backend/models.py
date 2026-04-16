from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone


class Machine(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    status: str = "idle"
    current_job_id: Optional[str] = None
    maintenance: bool = False
    maintenance_reason: Optional[str] = None
    maintenance_started: Optional[str] = None


class Job(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    koli_count: int
    colors: str
    machine_id: str
    machine_name: str
    format: Optional[str] = None
    notes: Optional[str] = None
    delivery_date: Optional[str] = None
    delivery_address: Optional[str] = None
    delivery_phone: Optional[str] = None
    image_url: Optional[str] = None
    status: str = "pending"
    operator_name: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    completed_koli: int = 0
    remaining_koli: int = 0
    order: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    queued_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    tracking_code: str = Field(default_factory=lambda: str(uuid.uuid4()))
    paused_at: Optional[str] = None
    pause_reason: Optional[str] = None
    produced_before_pause: int = 0
    transfer_history: List[dict] = Field(default_factory=list)


class Shift(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    ended_at: Optional[str] = None
    status: str = "active"
    pending_approval: bool = False


class ShiftEndOperatorReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shift_id: str
    operator_id: str
    operator_name: str
    machine_id: str
    machine_name: str
    job_id: Optional[str] = None
    job_name: Optional[str] = None
    target_koli: int = 0
    produced_koli: int = 0
    defect_kg: float = 0.0
    is_completed: bool = False
    status: str = "pending"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    approved_at: Optional[str] = None
    approved_by: Optional[str] = None


class DefectLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    machine_id: str
    machine_name: str
    shift_id: Optional[str] = None
    defect_kg: float = 0.0
    date: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ShiftEndReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shift_id: str
    machine_id: str
    machine_name: str
    job_id: Optional[str] = None
    job_name: Optional[str] = None
    target_koli: int = 0
    produced_koli: int = 0
    remaining_koli: int = 0
    defect_kg: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MaintenanceLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    machine_id: str
    machine_name: str
    reason: str
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    ended_at: Optional[str] = None


class WarehouseRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    operator_name: str
    machine_name: str
    item_type: str
    quantity: int
    status: str = "pending"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PalletScan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pallet_code: str
    job_id: str
    job_name: str
    operator_name: str
    scanned_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Paint(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    stock_kg: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PaintMovement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    paint_id: str
    paint_name: str
    movement_type: str
    amount_kg: float
    machine_id: Optional[str] = None
    machine_name: Optional[str] = None
    note: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ActivePaintToMachine(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    paint_id: str
    paint_name: str
    machine_id: str
    machine_name: str
    given_amount_kg: float
    returned: bool = False
    returned_amount_kg: float = 0.0
    used_amount_kg: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    returned_at: Optional[str] = None


class MachineMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    machine_id: str
    machine_name: str
    sender_role: str
    sender_name: str
    message: str
    is_read: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password: str
    role: str
    display_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True
    current_location_lat: Optional[float] = None
    current_location_lng: Optional[float] = None
    location_updated_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Visitor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ip_address: str
    user_agent: str
    device_type: str
    device_model: str
    browser: str
    os: str
    page_visited: str
    visited_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class OperatorSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str
    operator_name: str
    machine_id: Optional[str] = None
    machine_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_active: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    expires_at: str = Field(default_factory=lambda: (datetime.now(timezone.utc).replace(hour=23, minute=59, second=59)).isoformat())


class Pallet(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    job_id: str
    job_name: str
    machine_id: str
    machine_name: str
    koli_count: int
    operator_name: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    status: str = "in_warehouse"


class Vehicle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    plate: str
    driver_name: Optional[str] = None
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Shipment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicle_id: str
    vehicle_plate: str
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    pallets: List[str] = []
    total_koli: int = 0
    delivery_address: str
    delivery_phone: Optional[str] = None
    delivery_notes: Optional[str] = None
    status: str = "preparing"
    delivery_status_reason: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_by: str


class Driver(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    password: str
    phone: Optional[str] = None
    is_active: bool = True
    current_location_lat: Optional[float] = None
    current_location_lng: Optional[float] = None
    location_updated_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class WarehouseShipmentLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    shipment_id: str
    vehicle_plate: str
    pallet_ids: List[str] = []
    total_koli: int
    partial: bool = False
    delivered_koli: int = 0
    operator_name: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AuditLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user: str
    action: str
    entity_type: str
    entity_name: str = ""
    details: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AIChatRequest(BaseModel):
    message: str
    machine_id: str
    operator_name: str
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))


class AIManagementChatRequest(BaseModel):
    message: str
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))



# ==================== BOBİN TAKİP MODELLERİ ====================

class Bobin(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    brand: str  # Marka (Hayat, vs.)
    width_cm: float  # Genişlik (cm) - 24, 30, 33, 40
    grammage: float  # Gramaj (gr) - 17, 20, vs.
    color: str = "Beyaz"  # Kağıt rengi
    quantity: int = 0  # Adet (depodaki)
    total_weight_kg: float = 0.0  # Toplam ağırlık (kg)
    weight_per_piece_kg: float = 0.0  # Adet başı ağırlık (kg)
    supplier: Optional[str] = None  # Tedarikçi
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class BobinMovement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    bobin_id: str
    bobin_label: str  # "Hayat 24cm 17gr Beyaz" gibi özet
    movement_type: str  # "purchase", "to_machine", "sale", "adjustment"
    quantity: int = 0  # Adet değişimi
    weight_kg: float = 0.0  # Ağırlık değişimi
    machine_id: Optional[str] = None
    machine_name: Optional[str] = None
    customer_name: Optional[str] = None  # Müşteriye satış için
    note: Optional[str] = None
    user_name: str = ""  # İşlemi yapan kullanıcı
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
