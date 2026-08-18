from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import datetime
from typing import List, Dict, Any, Optional

from .database import engine, Base, get_db
from . import models, schemas, crud, engine as decision_engine, seed

app = FastAPI(title="Smart Warehouse Operations Platform API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For demo / hackathon simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure database tables exist immediately on app initialization
Base.metadata.create_all(bind=engine)

@app.on_event("startup")
def startup_event():
    # Automatically seed the database on initial startup if empty
    db = next(get_db())
    try:
        if db.query(models.Product).count() == 0:
            seed.seed_all(db)
            print("Database initialized and seeded.")
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

# --- Demo Reset ---
@app.post("/api/demo/reset")
def reset_demo(db: Session = Depends(get_db)):
    try:
        seed.seed_all(db)
        return {"status": "success", "message": "Database reset to initial demo state."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# --- Dashboard Stats ---
@app.get("/api/dashboard/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    now = datetime.datetime.now()
    
    # 1. Counts
    total_orders = db.query(models.Order).count()
    pending_orders = db.query(models.Order).filter(models.Order.status.in_(["Created", "Allocated"])).count()
    orders_picking = db.query(models.Order).filter(models.Order.status == "Picking").count()
    orders_packing = db.query(models.Order).filter(models.Order.status == "Packing").count()
    ready_dispatch = db.query(models.Order).filter(models.Order.status == "Ready for Dispatch").count()
    dispatched_orders = db.query(models.Order).filter(models.Order.status == "Dispatched").count()
    
    low_stock_products = db.query(models.Product).filter(models.Product.status == "Low Stock").count()
    out_of_stock_products = db.query(models.Product).filter(models.Product.status == "Out of Stock").count()
    critical_stock = db.query(models.Product).filter(models.Product.status == "Critical").count()
    total_low = low_stock_products + out_of_stock_products + critical_stock

    active_exceptions = db.query(models.ExceptionRecord).filter(models.ExceptionRecord.status == "Active").count()
    
    delayed_orders = db.query(models.Order).filter(
        models.Order.required_delivery_date < now,
        models.Order.status != "Dispatched"
    ).count()

    # 2. Smart Recommendations List
    recs = []
    
    # Delayed/At Risk Orders
    at_risk = db.query(models.Order).filter(
        models.Order.status != "Dispatched",
        models.Order.required_delivery_date <= now + datetime.timedelta(hours=2)
    ).all()
    if at_risk:
        recs.append(f"{len(at_risk)} urgent order(s) are at risk of delay. Delivery deadlines are within 2 hours.")

    # Reorder suggestions
    low_products = db.query(models.Product).filter(models.Product.status.in_(["Low Stock", "Critical", "Out of Stock"])).all()
    for p in low_products[:2]: # Show top 2 in dashboard list
        recs.append(f"Product {p.sku} ({p.name}) is below reorder level. Recommend replenishing {p.reorder_quantity} units.")

    # Bottleneck alerts
    bottleneck = decision_engine.detect_bottlenecks(db)
    if bottleneck["bottleneck_detected"]:
        recs.append(f"Fulfillment Bottleneck: {bottleneck['recommendation']}")

    # Shortage reallocation suggestion (Demo Scenario check)
    o104 = db.query(models.Order).filter(models.Order.customer == "Google Corp").first()
    o105 = db.query(models.Order).filter(models.Order.customer == "Mounir Dev").first()
    if o104 and o105 and o104.status == "Created" and o105.status == "Created":
        # Check if laptop allocation has not been done yet
        recs.append("Reallocate available stock of SKU-101 to Google Corp (Order #104) due to higher priority score (Critical).")

    if not recs:
        recs.append("All operations running within normal parameters. Keep monitoring dispatch lanes.")

    return schemas.DashboardStats(
        total_orders=total_orders,
        pending_orders=pending_orders,
        orders_picking=orders_picking,
        orders_packing=orders_packing,
        ready_dispatch=ready_dispatch,
        dispatched_orders=dispatched_orders,
        low_stock_products=total_low,
        out_of_stock_products=out_of_stock_products,
        active_exceptions=active_exceptions,
        delayed_orders=delayed_orders,
        smart_recommendations=recs
    )

# --- Products ---
@app.get("/api/products", response_model=List[schemas.Product])
def get_products(db: Session = Depends(get_db)):
    products = crud.get_products(db)
    # Trigger status refresh
    for p in products:
        decision_engine.update_product_status(p)
    db.commit()
    return products

# NOTE: /reorder MUST come before the generic POST /api/products route
# so FastAPI resolves specific paths first (before treating "reorder" as a body)
@app.post("/api/products/reorder")
def reorder_product(sku: str, qty: int, db: Session = Depends(get_db)):
    product = crud.get_product_by_sku(db, sku)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Increase stock
    product.total_stock += qty
    decision_engine.update_product_status(product)
    
    # Log reorder event
    exc_reorder = db.query(models.ExceptionRecord).filter(
        models.ExceptionRecord.product_id == product.id,
        models.ExceptionRecord.type == "Stock Shortage",
        models.ExceptionRecord.status == "Active"
    ).all()
    for exc in exc_reorder:
        exc.status = "Resolved"
        exc.resolution_action = f"Replenished {qty} units."
        
    db.commit()

    # Re-run stock allocation logic automatically!
    proposed, shortages = decision_engine.analyze_allocation_needs(db)
    for order_id, allocations in proposed.items():
        decision_engine.apply_allocation(db, order_id, allocations)

    return {"status": "success", "message": f"Successfully reordered {qty} units of {sku}."}


@app.post("/api/products", response_model=schemas.Product)
def create_product(product_in: schemas.ProductCreate, db: Session = Depends(get_db)):
    # Check if SKU already exists
    existing = crud.get_product_by_sku(db, product_in.sku)
    if existing:
        existing.total_stock += product_in.total_stock
        decision_engine.update_product_status(existing)
        db.commit()
        db.refresh(existing)
        return existing
    
    db_product = crud.create_product(db, product_in)
    decision_engine.update_product_status(db_product)
    db.commit()
    db.refresh(db_product)

    # Re-run proposed allocations in case new inventory fulfills waiting orders
    proposed, shortages = decision_engine.analyze_allocation_needs(db)
    for order_id, allocations in proposed.items():
        decision_engine.apply_allocation(db, order_id, allocations)

    return db_product

# --- Orders ---
@app.get("/api/orders", response_model=List[schemas.Order])
def get_orders(db: Session = Depends(get_db)):
    orders = db.query(models.Order).order_by(models.Order.id.desc()).all()
    
    # Enforce product detail retrieval for JSON schemas
    response = []
    for order in orders:
        items_res = []
        for item in order.items:
            items_res.append(schemas.OrderItemResponse(
                id=item.id,
                product_id=item.product_id,
                quantity=item.quantity,
                allocated_quantity=item.allocated_quantity,
                sku=item.product.sku,
                product_name=item.product.name,
                location=item.product.location
            ))
        
        exceptions_res = []
        for exc in order.exceptions:
            exceptions_res.append(schemas.ExceptionRecord(
                id=exc.id,
                order_id=exc.order_id,
                product_id=exc.product_id,
                type=exc.type,
                description=exc.description,
                status=exc.status,
                recommendation=exc.recommendation,
                resolution_action=exc.resolution_action,
                timestamp=exc.timestamp
            ))
            
        logs_res = []
        for log in order.logs:
            logs_res.append(schemas.FulfillmentLog(
                id=log.id,
                order_id=log.order_id,
                stage=log.stage,
                timestamp=log.timestamp,
                worker=log.worker,
                exceptions_if_any=log.exceptions_if_any
            ))

        response.append(schemas.Order(
            id=order.id,
            customer=order.customer,
            order_date=order.order_date,
            required_delivery_date=order.required_delivery_date,
            order_value=order.order_value,
            customer_type=order.customer_type,
            priority_score=order.priority_score,
            priority_level=order.priority_level,
            priority_reason=order.priority_reason,
            status=order.status,
            fulfillment_progress=order.fulfillment_progress,
            items=items_res,
            exceptions=exceptions_res,
            logs=logs_res
        ))
    return response

@app.post("/api/orders", response_model=schemas.Order)
def create_order(order_in: schemas.OrderCreate, db: Session = Depends(get_db)):
    db_order = crud.create_order(db, order_in)
    
    # Calculate priority
    score, level, reason = decision_engine.calculate_priority(db_order, db)
    db_order.priority_score = score
    db_order.priority_level = level
    db_order.priority_reason = reason
    db.commit()

    # Re-run proposed allocations
    proposed, shortages = decision_engine.analyze_allocation_needs(db)
    # Apply proposed allocations to see if stock is available
    if db_order.id in proposed:
        decision_engine.apply_allocation(db, db_order.id, proposed[db_order.id])
        
    db.refresh(db_order)
    
    # Assemble response
    items_res = [
        schemas.OrderItemResponse(
            id=item.id,
            product_id=item.product_id,
            quantity=item.quantity,
            allocated_quantity=item.allocated_quantity,
            sku=item.product.sku,
            product_name=item.product.name,
            location=item.product.location
        ) for item in db_order.items
    ]
    
    return schemas.Order(
        id=db_order.id,
        customer=db_order.customer,
        order_date=db_order.order_date,
        required_delivery_date=db_order.required_delivery_date,
        order_value=db_order.order_value,
        customer_type=db_order.customer_type,
        priority_score=db_order.priority_score,
        priority_level=db_order.priority_level,
        priority_reason=db_order.priority_reason,
        status=db_order.status,
        fulfillment_progress=db_order.fulfillment_progress,
        items=items_res,
        exceptions=[],
        logs=[schemas.FulfillmentLog(
            id=l.id,
            order_id=l.order_id,
            stage=l.stage,
            timestamp=l.timestamp,
            worker=l.worker,
            exceptions_if_any=l.exceptions_if_any
        ) for l in db_order.logs]
    )

# --- Decision Center ---
@app.get("/api/decision-center", response_model=List[schemas.DecisionItem])
def get_decisions(db: Session = Depends(get_db)):
    decisions = []

    # 1. Analyze allocation and find shortages
    proposed_alloc, shortages = decision_engine.analyze_allocation_needs(db)
    
    # Filter for active shortages (where order status is still Created/partial)
    for shortage in shortages:
        order = db.query(models.Order).filter(models.Order.id == shortage["order_id"]).first()
        # If it is already allocated fully, skip
        if order and order.status == "Allocated":
            continue

        item_names = [f"{i['name']} (Req: {i['required']}, Avail: {i['allocated']})" for i in shortage["items"]]
        desc_str = f"Stock Shortage detected for Order #{shortage['order_id']} ({shortage['customer']}). Items affected: {', '.join(item_names)}."
        rec_str = f"Allocate {sum(i['allocated'] for i in shortage['items'])} available units to high-priority Order #{shortage['order_id']} ({shortage['priority_level']}) and backorder the remaining units."
        
        decisions.append(schemas.DecisionItem(
            id=f"shortage-{shortage['order_id']}",
            type="Stock Shortage",
            title=f"Order #{shortage['order_id']} — Stock Shortage",
            description=desc_str,
            recommendation=rec_str,
            severity=shortage["priority_level"],
            meta={"order_id": shortage["order_id"], "allocations": proposed_alloc[shortage["order_id"]]}
        ))

    # 2. Reorder Recommendations
    low_products = db.query(models.Product).filter(models.Product.status.in_(["Low Stock", "Critical", "Out of Stock"])).all()
    for p in low_products:
        # Check if there is already a decision/exception
        severity = "Warning" if p.status == "Low Stock" else "Critical"
        desc = f"Product {p.sku} ({p.name}) available stock is {p.available_stock} which is below reorder level {p.reorder_level}."
        rec = f"Reorder {p.reorder_quantity} units immediately. Reason: Ensure fulfillment stock levels and resolve pending bottlenecks."
        
        decisions.append(schemas.DecisionItem(
            id=f"reorder-{p.sku}",
            type="Reorder Recommendation",
            title=f"Reorder Recommendation — {p.sku}",
            description=desc,
            recommendation=rec,
            severity=severity,
            meta={"sku": p.sku, "quantity": p.reorder_quantity}
        ))

    # 3. Operational Bottlenecks
    bottleneck = decision_engine.detect_bottlenecks(db)
    if bottleneck["bottleneck_detected"]:
        decisions.append(schemas.DecisionItem(
            id=f"bottleneck-{bottleneck['stage']}",
            type="Picking Bottleneck" if bottleneck["stage"] == "Picking" else "Operational Bottleneck",
            title=f"{bottleneck['stage']} Bottleneck Detected",
            description=bottleneck["metric"],
            recommendation=bottleneck["recommendation"],
            severity="High",
            meta={"stage": bottleneck["stage"]}
        ))

    return decisions

@app.post("/api/decision-center/execute")
def execute_decision(request: schemas.DecisionExecute, db: Session = Depends(get_db)):
    action = request.action
    decision_id = request.id
    
    if decision_id.startswith("shortage-"):
        order_id = int(decision_id.removeprefix("shortage-"))
        if action == "Accept":
            # Apply proposed allocation
            proposed, shortages = decision_engine.analyze_allocation_needs(db)
            if order_id in proposed:
                decision_engine.apply_allocation(db, order_id, proposed[order_id])
                
                # Check for other orders that compete and set their allocated stock to 0 explicitly
                competing_orders = db.query(models.Order).filter(
                    models.Order.id != order_id,
                    models.Order.status == "Created"
                ).all()
                for c_order in competing_orders:
                    # Rerun allocation to make sure they get updated
                    if c_order.id in proposed:
                        decision_engine.apply_allocation(db, c_order.id, proposed[c_order.id])
                
                db.commit()
                return {"status": "success", "message": f"Applied partial stock allocation recommendation to Order #{order_id}."}
        return {"status": "ignored", "message": "Decision dismissed or rejected."}

    elif decision_id.startswith("reorder-"):
        sku = decision_id.removeprefix("reorder-")
        if action == "Approve":
            product = db.query(models.Product).filter(models.Product.sku == sku).first()
            if not product:
                raise HTTPException(status_code=404, detail="Product not found")
            
            qty = product.reorder_quantity
            product.total_stock += qty
            decision_engine.update_product_status(product)
            
            # Resolve exception
            excs = db.query(models.ExceptionRecord).filter(
                models.ExceptionRecord.product_id == product.id,
                models.ExceptionRecord.status == "Active"
            ).all()
            for exc in excs:
                exc.status = "Resolved"
                exc.resolution_action = f"Approved automatic reorder of {qty} units."
            
            # Re-run stock allocation logic
            proposed, shortages = decision_engine.analyze_allocation_needs(db)
            for order_id, allocations in proposed.items():
                decision_engine.apply_allocation(db, order_id, allocations)
                
            db.commit()
            return {"status": "success", "message": f"Successfully ordered {qty} units of {sku} and reallocated stock."}
        return {"status": "ignored", "message": "Reorder recommendation dismissed."}

    elif decision_id.startswith("bottleneck-"):
        stage = decision_id.removeprefix("bottleneck-")
        if action == "Accept":
            # Reassign a random picker to Zone
            picker = db.query(models.Employee).filter(
                models.Employee.role == "Picker",
                models.Employee.status == "Active"
            ).first()
            if picker:
                picker.zone = "Zone B"
                db.commit()
                return {"status": "success", "message": f"Reassigned picker {picker.name} to Zone B."}
            return {"status": "success", "message": "Reassigned picker staff to ease bottlenecks."}
        return {"status": "ignored", "message": "Bottleneck recommendation dismissed."}

    raise HTTPException(status_code=400, detail="Invalid decision parameters")

# --- Exceptions ---
@app.get("/api/exceptions", response_model=List[schemas.ExceptionRecord])
def get_exceptions(db: Session = Depends(get_db)):
    exceptions = crud.get_exceptions(db)
    response = []
    for exc in exceptions:
        response.append(schemas.ExceptionRecord(
            id=exc.id,
            order_id=exc.order_id,
            product_id=exc.product_id,
            product_sku=exc.product.sku if exc.product else None,
            order_customer=exc.order.customer if exc.order else None,
            type=exc.type,
            description=exc.description,
            status=exc.status,
            recommendation=exc.recommendation,
            resolution_action=exc.resolution_action,
            timestamp=exc.timestamp
        ))
    return response

@app.post("/api/exceptions/{exc_id}/resolve")
def resolve_exception(exc_id: int, resolution_in: Optional[Dict[str, str]] = None, db: Session = Depends(get_db)):
    if resolution_in is None:
        resolution_in = {}
    exc = db.query(models.ExceptionRecord).filter(models.ExceptionRecord.id == exc_id).first()
    if not exc:
        raise HTTPException(status_code=404, detail="Exception not found")
    
    action = resolution_in.get("action", "Resolved manually")
    exc.status = "Resolved"
    exc.resolution_action = action

    # Handle specific resolutions
    if exc.type == "Damaged Item" and exc.product:
        # Check stock and deduct damaged item
        product = exc.product
        if product.total_stock > 0:
            product.total_stock -= 1 # deduct the damaged unit
            # Release 1 reserved unit for the order if it was allocated
            if exc.order_id:
                order = db.query(models.Order).filter(models.Order.id == exc.order_id).first()
                # Find matching order item
                for item in order.items:
                    if item.product_id == product.id and item.allocated_quantity > 0:
                        item.allocated_quantity -= 1
                        product.reserved_stock -= 1
                        break
            decision_engine.update_product_status(product)

            # Re-run allocation to resolve the deficit
            proposed, shortages = decision_engine.analyze_allocation_needs(db)
            for order_id, allocations in proposed.items():
                decision_engine.apply_allocation(db, order_id, allocations)

    db.commit()
    return {"status": "success", "message": f"Exception {exc_id} marked as resolved."}

# --- Employees ---
@app.get("/api/employees", response_model=List[schemas.Employee])
def get_employees(db: Session = Depends(get_db)):
    return crud.get_employees(db)

# --- Progress Order Fulfillment Flow (Demo Control) ---
@app.post("/api/orders/{order_id}/step")
def step_order(order_id: int, worker: Optional[str] = None, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    status_pipeline = [
        "Created",
        "Allocated",
        "Picking",
        "Packing",
        "Quality Check",
        "Ready for Dispatch",
        "Dispatched"
    ]
    
    current_status = order.status
    if current_status not in status_pipeline:
        raise HTTPException(status_code=400, detail="Invalid order status state")
        
    curr_idx = status_pipeline.index(current_status)
    if curr_idx == len(status_pipeline) - 1:
        return {"status": "success", "message": "Order is already fully Dispatched."}
        
    next_status = status_pipeline[curr_idx + 1]
    
    # Validation rules for moving forward:
    if next_status == "Allocated":
        # Check if fully allocated
        for item in order.items:
            if item.allocated_quantity < item.quantity:
                raise HTTPException(
                    status_code=400, 
                    detail="Cannot progress to Allocated. Insufficient inventory allocated."
                )

    # Assign random employee as worker if not provided
    if not worker:
        role_map = {
            "Picking": "Picker",
            "Packing": "Packer",
            "Quality Check": "Inspector",
            "Ready for Dispatch": "Inspector",
            "Dispatched": "Dispatcher"
        }
        required_role = role_map.get(next_status, "Picker")
        emp = db.query(models.Employee).filter(models.Employee.role == required_role).first()
        worker = emp.name if emp else "Operator"

    # Set new status
    order.status = next_status
    progress_map = {
        "Created": 0,
        "Allocated": 20,
        "Picking": 40,
        "Packing": 60,
        "Quality Check": 80,
        "Ready for Dispatch": 90,
        "Dispatched": 100
    }
    order.fulfillment_progress = progress_map[next_status]

    # Special logic when order becomes DISPATCHED:
    # We must actually deduct the stock from inventory!
    if next_status == "Dispatched":
        for item in order.items:
            product = item.product
            # Deduct from total stock and from reserved stock
            product.total_stock = max(0, product.total_stock - item.allocated_quantity)
            product.reserved_stock = max(0, product.reserved_stock - item.allocated_quantity)
            item.allocated_quantity = 0 # reset item allocation since dispatched
            decision_engine.update_product_status(product)

    # Add to fulfillment log
    log = models.FulfillmentLog(
        order_id=order.id,
        stage=next_status,
        worker=worker,
        exceptions_if_any=""
    )
    db.add(log)
    db.commit()
    db.refresh(order)
    
    return {"status": "success", "message": f"Order #{order.id} moved to {next_status}.", "order_status": order.status}

# --- Optimized Picking Route helper ---
@app.get("/api/orders/{order_id}/picking-route")
def get_order_picking_route(order_id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    locations = [item.product.location for item in order.items]
    route = decision_engine.optimize_picking_route(locations)
    
    return {
        "order_id": order_id,
        "items": [{"sku": i.product.sku, "name": i.product.name, "location": i.product.location} for i in order.items],
        "optimized_route": route
    }
