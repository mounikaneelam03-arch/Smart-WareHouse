import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app import models, engine as decision_engine

# Setup in-memory database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def test_decision_engine():
    # 1. Initialize tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    try:
        # 2. Seed basic data for testing
        product = models.Product(
            sku="SKU-TEST-01",
            name="Test Laptop",
            category="Electronics",
            location="A2",
            total_stock=7,
            reserved_stock=0,
            reorder_level=10,
            reorder_quantity=50
        )
        db.add(product)
        db.commit()
        db.refresh(product)
        
        # Test Product status update
        decision_engine.update_product_status(product)
        assert product.status == "Low Stock"  # stock (7) <= reorder_level (10)
        
        # 3. Create normal order and critical order
        now = datetime.datetime.now()
        
        order_critical = models.Order(
            customer="VIP Customer",
            order_date=now,
            required_delivery_date=now + datetime.timedelta(hours=1), # very urgent
            order_value=2000.0,
            customer_type="VIP",
            status="Created"
        )
        db.add(order_critical)
        db.commit()
        db.refresh(order_critical)
        
        item_critical = models.OrderItem(
            order_id=order_critical.id,
            product_id=product.id,
            quantity=10 # requires 10
        )
        db.add(item_critical)
        db.commit()
        
        order_normal = models.Order(
            customer="Regular Customer",
            order_date=now,
            required_delivery_date=now + datetime.timedelta(hours=24), # standard
            order_value=500.0,
            customer_type="Regular",
            status="Created"
        )
        db.add(order_normal)
        db.commit()
        db.refresh(order_normal)
        
        item_normal = models.OrderItem(
            order_id=order_normal.id,
            product_id=product.id,
            quantity=5 # requires 5
        )
        db.add(item_normal)
        db.commit()
        
        # Test priority calculations
        score_crit, level_crit, _ = decision_engine.calculate_priority(order_critical, db)
        score_norm, level_norm, _ = decision_engine.calculate_priority(order_normal, db)
        
        assert score_crit > score_norm
        assert level_crit == "Critical"
        assert level_norm in ["Medium", "High", "Low"]
        
        # Test proposed stock allocation logic
        proposed, shortages = decision_engine.analyze_allocation_needs(db)
        
        # Verification of demo scenario allocation proposal:
        # Order critical (VIP, score high) gets 7 units allocated
        # Order normal gets 0 units allocated
        # Insufficient stock is detected, shortage created
        assert order_critical.id in proposed
        assert order_normal.id in proposed
        
        alloc_crit = proposed[order_critical.id]
        alloc_norm = proposed[order_normal.id]
        
        # item_critical item_id, product_id, qty
        assert alloc_crit[0][2] == 7 # all 7 available units allocated to VIP
        assert alloc_norm[0][2] == 0 # 0 allocated to Normal order due to shortage
        
        assert len(shortages) > 0
        assert shortages[0]["order_id"] == order_critical.id
        
        # Apply proposed allocation to critical order
        decision_engine.apply_allocation(db, order_critical.id, alloc_crit)
        db.refresh(product)
        db.refresh(order_critical)
        
        assert product.reserved_stock == 7
        assert product.available_stock == 0
        assert order_critical.status == "Created" # Remains created because partial allocation (7/10)
        
        # Test route optimization
        locations = ["B2", "A2", "C1"]
        optimized_route = decision_engine.optimize_picking_route(locations)
        assert optimized_route[0] == "Receiving"
        assert optimized_route[-1] == "Packing Station"
        # Verify all locations visited
        for loc in locations:
            assert loc in optimized_route
            
        print("ALL TESTS PASSED SUCCESSFULLY!")
        
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

if __name__ == "__main__":
    test_decision_engine()
