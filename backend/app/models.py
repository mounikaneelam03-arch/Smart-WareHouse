import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from .database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    location = Column(String, nullable=False)  # e.g., "A2", "B1", "C3"
    total_stock = Column(Integer, default=0)
    reserved_stock = Column(Integer, default=0)
    reorder_level = Column(Integer, default=10)
    reorder_quantity = Column(Integer, default=50)
    status = Column(String, default="Healthy")  # Healthy, Low Stock, Critical, Out of Stock

    @property
    def available_stock(self):
        return max(0, self.total_stock - self.reserved_stock)

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    customer = Column(String, nullable=False)
    order_date = Column(DateTime, default=datetime.datetime.now)
    required_delivery_date = Column(DateTime, nullable=False)
    order_value = Column(Float, default=0.0)
    customer_type = Column(String, default="Regular")  # Regular, Premium, VIP
    priority_score = Column(Integer, default=0)
    priority_level = Column(String, default="Low")  # Low, Medium, High, Critical
    priority_reason = Column(String, default="")
    status = Column(String, default="Created")  # Created, Allocated, Picking, Packing, Quality Check, Ready for Dispatch, Dispatched
    fulfillment_progress = Column(Integer, default=0)  # Percentage 0 to 100

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    exceptions = relationship("ExceptionRecord", back_populates="order", cascade="all, delete-orphan")
    logs = relationship("FulfillmentLog", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    allocated_quantity = Column(Integer, default=0)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")

class ExceptionRecord(Base):
    __tablename__ = "exceptions"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    type = Column(String, nullable=False)  # Stock Shortage, Out of Stock, Damaged Item, Missing Item, Picking Delay, Packing Issue, Quality Check Failure, Dispatch Delay
    description = Column(String, nullable=False)
    status = Column(String, default="Active")  # Active, Resolved
    recommendation = Column(String, nullable=True)
    resolution_action = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.now)

    order = relationship("Order", back_populates="exceptions")
    product = relationship("Product")

class FulfillmentLog(Base):
    __tablename__ = "fulfillment_logs"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    stage = Column(String, nullable=False)  # e.g., Created, Priority Assigned, Stock Allocated, Picking, Packing, Quality Check, Ready for Dispatch, Dispatched
    timestamp = Column(DateTime, default=datetime.datetime.now)
    worker = Column(String, nullable=True)
    exceptions_if_any = Column(String, nullable=True)

    order = relationship("Order", back_populates="logs")

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # Picker, Packer, Inspector, Dispatcher
    zone = Column(String, nullable=True)   # e.g., "Zone A", "Zone B", "Zone C"
    status = Column(String, default="Active")  # Active, Busy, Inactive
