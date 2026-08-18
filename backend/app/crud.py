from sqlalchemy.orm import Session
from . import models, schemas
import datetime

# --- Products ---
def get_product(db: Session, product_id: int):
    return db.query(models.Product).filter(models.Product.id == product_id).first()

def get_product_by_sku(db: Session, sku: str):
    return db.query(models.Product).filter(models.Product.sku == sku).first()

def get_products(db: Session):
    return db.query(models.Product).all()

def create_product(db: Session, product: schemas.ProductCreate):
    db_product = models.Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

# --- Orders ---
def get_order(db: Session, order_id: int):
    return db.query(models.Order).filter(models.Order.id == order_id).first()

def get_orders(db: Session):
    return db.query(models.Order).order_by(models.Order.priority_score.desc()).all()

def create_order(db: Session, order_in: schemas.OrderCreate):
    # Create the Order base
    db_order = models.Order(
        customer=order_in.customer,
        required_delivery_date=order_in.required_delivery_date,
        order_value=order_in.order_value,
        customer_type=order_in.customer_type,
        status="Created"
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)

    # Create the Order Items
    for item in order_in.items:
        db_item = models.OrderItem(
            order_id=db_order.id,
            product_id=item.product_id,
            quantity=item.quantity,
            allocated_quantity=0
        )
        db.add(db_item)

    # Initial Log
    db_log = models.FulfillmentLog(
        order_id=db_order.id,
        stage="Order Created",
        worker="API Gateway",
        exceptions_if_any=""
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_order)
    return db_order

# --- Exceptions ---
def get_exceptions(db: Session):
    return db.query(models.ExceptionRecord).order_by(models.ExceptionRecord.timestamp.desc()).all()

def get_active_exceptions(db: Session):
    return db.query(models.ExceptionRecord).filter(models.ExceptionRecord.status == "Active").all()

# --- Employees ---
def get_employees(db: Session):
    return db.query(models.Employee).all()

def get_employee(db: Session, employee_id: int):
    return db.query(models.Employee).filter(models.Employee.id == employee_id).first()
