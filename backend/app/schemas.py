from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

# --- Product Schemas ---
class ProductBase(BaseModel):
    sku: str
    name: str
    category: str
    location: str
    total_stock: int
    reserved_stock: int
    reorder_level: int
    reorder_quantity: int
    status: str

class ProductCreate(ProductBase):
    pass

class Product(ProductBase):
    id: int
    available_stock: int

    model_config = ConfigDict(from_attributes=True)

# --- Order Item Schemas ---
class OrderItemBase(BaseModel):
    product_id: int
    quantity: int

class OrderItemCreate(OrderItemBase):
    pass

class OrderItemResponse(OrderItemBase):
    id: int
    allocated_quantity: int
    sku: Optional[str] = None
    product_name: Optional[str] = None
    location: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# --- Fulfillment Log ---
class FulfillmentLogBase(BaseModel):
    stage: str
    timestamp: datetime
    worker: Optional[str] = None
    exceptions_if_any: Optional[str] = None

class FulfillmentLog(FulfillmentLogBase):
    id: int
    order_id: int

    model_config = ConfigDict(from_attributes=True)

# --- Exception Record ---
class ExceptionRecordBase(BaseModel):
    type: str
    description: str
    status: str
    recommendation: Optional[str] = None
    resolution_action: Optional[str] = None
    timestamp: datetime

class ExceptionRecord(ExceptionRecordBase):
    id: int
    order_id: Optional[int] = None
    product_id: Optional[int] = None
    product_sku: Optional[str] = None
    order_customer: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# --- Order Schemas ---
class OrderBase(BaseModel):
    customer: str
    required_delivery_date: datetime
    order_value: float
    customer_type: str

class OrderCreate(OrderBase):
    items: List[OrderItemCreate]

class Order(OrderBase):
    id: int
    order_date: datetime
    priority_score: int
    priority_level: str
    priority_reason: str
    status: str
    fulfillment_progress: int
    items: List[OrderItemResponse]
    exceptions: List[ExceptionRecord] = []
    logs: List[FulfillmentLog] = []

    model_config = ConfigDict(from_attributes=True)

# --- Employee ---
class EmployeeBase(BaseModel):
    name: str
    role: str
    zone: Optional[str] = None
    status: str

class Employee(EmployeeBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

# --- Decision Schemas ---
class DecisionItem(BaseModel):
    id: str  # Type-ID combo or custom string
    type: str  # "Stock Shortage", "Reorder Recommendation", "Picking Bottleneck"
    title: str
    description: str
    recommendation: str
    severity: str  # "Critical", "High", "Warning", "Info"
    meta: Optional[dict] = None  # Extra info like order_id, product_id, picker_id

class DecisionExecute(BaseModel):
    id: str
    action: str  # "Accept", "Reject", "Approve", "Dismiss"
    meta: Optional[dict] = None

# --- Dashboard Stats ---
class DashboardStats(BaseModel):
    total_orders: int
    pending_orders: int
    orders_picking: int
    orders_packing: int
    ready_dispatch: int
    dispatched_orders: int
    low_stock_products: int
    out_of_stock_products: int
    active_exceptions: int
    delayed_orders: int
    smart_recommendations: List[str]
