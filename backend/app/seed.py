import datetime
from sqlalchemy.orm import Session
from .database import engine, Base
from . import models, engine as decision_engine

def seed_all(db: Session):
    # Drop all tables and recreate them to ensure a clean slate
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # 1. Add Employees
    employees = [
        models.Employee(name="Marcus Vance", role="Picker", zone="Zone A", status="Active"),
        models.Employee(name="Sarah Connor", role="Picker", zone="Zone B", status="Busy"),
        models.Employee(name="Mike Tyson", role="Packer", zone="Zone C", status="Active"),
        models.Employee(name="Jessica Alba", role="Inspector", zone="Zone D", status="Active"),
        models.Employee(name="David Beckham", role="Dispatcher", zone="Zone E", status="Active")
    ]
    for emp in employees:
        db.add(emp)
    db.commit()

    # 2. Add Products
    products = [
        models.Product(
            sku="SKU-101",
            name="ThinkPad X1 Carbon (Laptop)",
            category="Electronics",
            location="A2",
            total_stock=7,
            reserved_stock=0,
            reorder_level=10,
            reorder_quantity=50,
            status="Low Stock" # will be calculated by status checker anyway
        ),
        models.Product(
            sku="SKU-102",
            name="Logitech MX Master 3S (Mouse)",
            category="Peripherals",
            location="B1",
            total_stock=50,
            reserved_stock=0,
            reorder_level=15,
            reorder_quantity=100,
            status="Healthy"
        ),
        models.Product(
            sku="SKU-103",
            name="Dell UltraSharp 27 Monitor",
            category="Electronics",
            location="B2",
            total_stock=15,
            reserved_stock=0,
            reorder_level=5,
            reorder_quantity=20,
            status="Healthy"
        ),
        models.Product(
            sku="SKU-104",
            name="Keychron K2 Keyboard",
            category="Peripherals",
            location="C1",
            total_stock=5,
            reserved_stock=0,
            reorder_level=10,
            reorder_quantity=50,
            status="Critical"
        ),
        models.Product(
            sku="SKU-105",
            name="Anker USB-C Hub 8-in-1",
            category="Peripherals",
            location="C2",
            total_stock=4,
            reserved_stock=0,
            reorder_level=8,
            reorder_quantity=30,
            status="Critical"
        )
    ]
    for p in products:
        # Initial status setting
        decision_engine.update_product_status(p)
        db.add(p)
    db.commit()

    # Map products for reference
    prod_map = {p.sku: p for p in products}

    # 3. Create Orders (and OrderItems)
    now = datetime.datetime.now()

    # Order #104 (Critical Demo Order)
    o104 = models.Order(
        customer="Google Corp",
        order_date=now - datetime.timedelta(minutes=30),
        required_delivery_date=now + datetime.timedelta(hours=1.5), # VIP urgent delivery
        order_value=15000.0,
        customer_type="VIP",
        status="Created",
        fulfillment_progress=0
    )
    db.add(o104)
    db.commit()
    db.add(models.OrderItem(order_id=o104.id, product_id=prod_map["SKU-101"].id, quantity=10))
    db.add(models.FulfillmentLog(order_id=o104.id, stage="Order Created", worker="API Gateway"))
    db.commit()

    # Order #105 (Normal Demo Order competing with o104)
    o105 = models.Order(
        customer="Mounir Dev",
        order_date=now - datetime.timedelta(minutes=15),
        required_delivery_date=now + datetime.timedelta(hours=24), # 24h deadline
        order_value=7500.0,
        customer_type="Regular",
        status="Created",
        fulfillment_progress=0
    )
    db.add(o105)
    db.commit()
    db.add(models.OrderItem(order_id=o105.id, product_id=prod_map["SKU-101"].id, quantity=5))
    db.add(models.FulfillmentLog(order_id=o105.id, stage="Order Created", worker="API Gateway"))
    db.commit()

    # Order #101 (Another order with stock shortages: USB-C Hub and Monitors)
    o101 = models.Order(
        customer="Tesla Labs",
        order_date=now - datetime.timedelta(hours=5),
        required_delivery_date=now + datetime.timedelta(hours=48),
        order_value=2400.0,
        customer_type="Premium",
        status="Created",
        fulfillment_progress=0
    )
    db.add(o101)
    db.commit()
    db.add(models.OrderItem(order_id=o101.id, product_id=prod_map["SKU-102"].id, quantity=15))
    db.add(models.OrderItem(order_id=o101.id, product_id=prod_map["SKU-103"].id, quantity=5))
    db.add(models.OrderItem(order_id=o101.id, product_id=prod_map["SKU-105"].id, quantity=5)) # 5 required, only 4 available
    db.add(models.FulfillmentLog(order_id=o101.id, stage="Order Created", worker="API Gateway"))
    db.commit()

    # Order #102 (Standard, fully allocatable order)
    o102 = models.Order(
        customer="Alice Smith",
        order_date=now - datetime.timedelta(hours=12),
        required_delivery_date=now + datetime.timedelta(hours=72),
        order_value=300.0,
        customer_type="Regular",
        status="Created",
        fulfillment_progress=0
    )
    db.add(o102)
    db.commit()
    db.add(models.OrderItem(order_id=o102.id, product_id=prod_map["SKU-102"].id, quantity=3))
    db.add(models.FulfillmentLog(order_id=o102.id, stage="Order Created", worker="API Gateway"))
    db.commit()

    # Order #103 (An order already in Picking to demonstrate exceptions)
    o103 = models.Order(
        customer="SpaceX Operations",
        order_date=now - datetime.timedelta(hours=6),
        required_delivery_date=now + datetime.timedelta(hours=3),
        order_value=4500.0,
        customer_type="Premium",
        status="Picking",
        fulfillment_progress=40
    )
    db.add(o103)
    db.commit()
    db.add(models.OrderItem(order_id=o103.id, product_id=prod_map["SKU-104"].id, quantity=1, allocated_quantity=1))
    prod_map["SKU-104"].reserved_stock += 1
    db.add(models.FulfillmentLog(order_id=o103.id, stage="Order Created", worker="API Gateway"))
    db.add(models.FulfillmentLog(order_id=o103.id, stage="Stock Allocated", worker="System Engine"))
    db.add(models.FulfillmentLog(order_id=o103.id, stage="Picking", worker="Sarah Connor"))
    db.commit()

    # 4. Generate Pre-Seeded Exceptions
    # Exception A: Damaged Item during picking for Order #103
    exc_damaged = models.ExceptionRecord(
        order_id=o103.id,
        product_id=prod_map["SKU-104"].id,
        type="Damaged Item",
        description="Keychron K2 Keyboard SKU-104 was damaged during picking by Sarah Connor in Zone B.",
        status="Active",
        recommendation="Replace damaged item with available stock (4 units available)."
    )
    db.add(exc_damaged)

    # Exception B: Missing Item for SKU-105
    exc_missing = models.ExceptionRecord(
        order_id=None,
        product_id=prod_map["SKU-105"].id,
        type="Missing Item",
        description="USB-C Hub SKU-105 was reported missing at Location C2 during inventory cycle count.",
        status="Active",
        recommendation="Check alternate warehouse location C4. Search inventory. If not found, mark as missing and trigger replenishment."
    )
    db.add(exc_missing)
    db.commit()

    # 5. Run initial priority score calculation for all seeded orders
    all_orders = db.query(models.Order).all()
    for order in all_orders:
        score, level, reason = decision_engine.calculate_priority(order, db)
        order.priority_score = score
        order.priority_level = level
        order.priority_reason = reason
    db.commit()
